using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.Modules.Reports
{
    public class ReportsService : IReportsService
    {
        private readonly AppDbContext _context;

        public ReportsService(AppDbContext context)
        {
            _context = context;
        }

        private static DateTime NormalizeUtc(DateTime value) => value.Kind switch
        {
            DateTimeKind.Utc   => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _                  => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

        public async Task<DashboardSummaryDto> GetDashboardSummaryAsync(DateTime? startDate, DateTime? endDate)
        {
            var now         = DateTime.UtcNow;
            var windowEnd   = NormalizeUtc(endDate ?? now);
            var windowStart = NormalizeUtc(startDate ?? new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc));

            var totalBookings     = await _context.Bookings.CountAsync();
            var pendingBookings   = await _context.Bookings.CountAsync(b => b.Status == BookingStatus.Pending);
            var completedBookings = await _context.Bookings.CountAsync(b => b.Status == BookingStatus.Completed);
            var activeCustomers   = await _context.Users.CountAsync(u => u.IsActive && u.Role == "Customer");
            var activePackages    = await _context.Packages.CountAsync(p => p.IsActive);
            var activeServices    = await _context.Services.CountAsync(s => s.IsActive);
            var activeProducts    = await _context.Products.CountAsync(p => p.IsActive);
            var recentBookings    = await _context.Bookings.CountAsync(b => b.CreatedAt >= windowStart && b.CreatedAt <= windowEnd);
            var recentRevenue     = await _context.Bookings
                .Where(b => b.CreatedAt >= windowStart && b.CreatedAt <= windowEnd && b.Status != BookingStatus.Cancelled)
                .SumAsync(b => (decimal?)b.TotalAmount) ?? 0m;
            var lifetimeRevenue   = await _context.Bookings
                .Where(b => b.Status != BookingStatus.Cancelled)
                .SumAsync(b => (decimal?)b.TotalAmount) ?? 0m;

            return new DashboardSummaryDto
            {
                WindowStart       = windowStart,
                WindowEnd         = windowEnd,
                TotalBookings     = totalBookings,
                PendingBookings   = pendingBookings,
                CompletedBookings = completedBookings,
                ActiveCustomers   = activeCustomers,
                ActivePackages    = activePackages,
                ActiveServices    = activeServices,
                ActiveProducts    = activeProducts,
                RecentBookings    = recentBookings,
                RecentRevenue     = recentRevenue,
                LifetimeRevenue   = lifetimeRevenue
            };
        }

        public async Task<FinancialReportDto> GetFinancialReportAsync(DateTime? startDate, DateTime? endDate)
        {
            var start = NormalizeUtc(startDate ?? DateTime.UtcNow.AddDays(-30));
            var end   = NormalizeUtc(endDate   ?? DateTime.UtcNow);

            var bookings = await _context.Bookings
                .Where(b => b.CreatedAt >= start && b.CreatedAt <= end && b.Status != BookingStatus.Cancelled)
                .ToListAsync();

            var totalRevenue  = bookings.Sum(b => b.TotalAmount);
            var totalCost     = bookings.Sum(b => b.EstimatedCost);
            var totalProfit   = totalRevenue - totalCost;
            var profitMargin  = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

            var dailyBreakdown = bookings
                .GroupBy(b => b.ScheduledDate.Date)
                .Select(g => new DailyFinancialDto
                {
                    Date         = g.Key,
                    Revenue      = g.Sum(b => b.TotalAmount),
                    Cost         = g.Sum(b => b.EstimatedCost),
                    Profit       = g.Sum(b => b.TotalAmount - b.EstimatedCost),
                    BookingCount = g.Count()
                })
                .OrderBy(d => d.Date)
                .ToList();

            var completedBookingIds = bookings
                .Where(b => b.Status == BookingStatus.Completed)
                .Select(b => b.Id)
                .ToList();

            var bookingItemsWithServices = await _context.BookingItems
                .Where(bi => completedBookingIds.Contains(bi.BookingId))
                .Include(bi => bi.Package)
                    .ThenInclude(p => p.PackageServices)
                        .ThenInclude(ps => ps.Service)
                            .ThenInclude(s => s.ServiceProducts)
                                .ThenInclude(sp => sp.Product)
                .ToListAsync();

            var serviceMarginMap = new Dictionary<string, (string package, int count, decimal rev, decimal cost)>();
            foreach (var item in bookingItemsWithServices)
            {
                var itemRevenue  = item.Price * item.Quantity;
                var serviceCount = item.Package?.PackageServices?.Count ?? 1;

                foreach (var ps in item.Package?.PackageServices ?? new List<PackageService>())
                {
                    var svcName  = ps.Service?.Name ?? "Unknown";
                    var key      = $"{svcName}||{item.Package?.Name ?? ""}";
                    var svcCost  = (ps.Service?.ServiceProducts ?? new List<ServiceProduct>())
                        .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit) * item.Quantity;
                    var svcRevShare = serviceCount > 0 ? itemRevenue / serviceCount : 0;

                    if (serviceMarginMap.ContainsKey(key))
                    {
                        var cur = serviceMarginMap[key];
                        serviceMarginMap[key] = (cur.package, cur.count + item.Quantity, cur.rev + svcRevShare, cur.cost + svcCost);
                    }
                    else
                    {
                        serviceMarginMap[key] = (item.Package?.Name ?? "", item.Quantity, svcRevShare, svcCost);
                    }
                }
            }

            var serviceMargins = serviceMarginMap
                .Select(kvp =>
                {
                    var parts  = kvp.Key.Split("||");
                    var profit = kvp.Value.rev - kvp.Value.cost;
                    var margin = kvp.Value.rev > 0 ? (profit / kvp.Value.rev) * 100 : 0;
                    return new ServiceMarginDto
                    {
                        ServiceName   = parts[0],
                        PackageName   = kvp.Value.package,
                        JobCount      = kvp.Value.count,
                        TotalRevenue  = Math.Round(kvp.Value.rev, 2),
                        TotalCost     = Math.Round(kvp.Value.cost, 2),
                        TotalProfit   = Math.Round(profit, 2),
                        MarginPercent = Math.Round(margin, 1),
                    };
                })
                .OrderByDescending(s => s.TotalRevenue)
                .ToList();

            var outstandingBookings = await _context.Bookings
                .Where(b => b.Status != BookingStatus.Cancelled
                         && (b.PaymentStatus == PaymentStatus.PreAuthorized || b.PaymentStatus == PaymentStatus.Failed))
                .OrderBy(b => b.ScheduledDate)
                .Select(b => new OutstandingPaymentDto
                {
                    BookingId     = b.Id,
                    BookingNumber = b.BookingNumber,
                    CustomerName  = b.CustomerName,
                    Amount        = b.TotalAmount,
                    PaymentStatus = b.PaymentStatus.ToString(),
                    BookingStatus = b.Status.ToString(),
                    ScheduledDate = b.ScheduledDate,
                })
                .ToListAsync();

            return new FinancialReportDto
            {
                StartDate           = start,
                EndDate             = end,
                TotalRevenue        = totalRevenue,
                TotalCost           = totalCost,
                TotalProfit         = totalProfit,
                ProfitMarginPercent = profitMargin,
                TotalBookings       = bookings.Count,
                AverageBookingValue = bookings.Count > 0 ? totalRevenue / bookings.Count : 0,
                DailyBreakdown      = dailyBreakdown,
                ServiceMargins      = serviceMargins,
                OutstandingPayments = outstandingBookings,
                OutstandingTotal    = outstandingBookings.Sum(p => p.Amount),
            };
        }

        public async Task<OperationalReportDto> GetOperationalReportAsync(DateTime? startDate, DateTime? endDate)
        {
            var start = NormalizeUtc(startDate ?? DateTime.UtcNow.AddDays(-30));
            var end   = NormalizeUtc(endDate   ?? DateTime.UtcNow);

            var bookings = await _context.Bookings
                .Where(b => b.CreatedAt >= start && b.CreatedAt <= end)
                .Include(b => b.BookingItems)
                    .ThenInclude(bi => bi.Package)
                .ToListAsync();

            var bookingsByStatus  = bookings.GroupBy(b => b.Status.ToString()).ToDictionary(g => g.Key, g => g.Count());
            var packagePopularity = bookings
                .SelectMany(b => b.BookingItems)
                .GroupBy(bi => new { bi.PackageId, bi.Package.Name, bi.Package.Tier })
                .Select(g => new PackagePopularityDto
                {
                    PackageName  = g.Key.Name,
                    Tier         = g.Key.Tier,
                    BookingCount = g.Sum(bi => bi.Quantity),
                    TotalRevenue = g.Sum(bi => bi.Price * bi.Quantity)
                })
                .OrderByDescending(p => p.BookingCount)
                .ToList();

            var packageIds = bookings.SelectMany(b => b.BookingItems.Select(bi => bi.PackageId)).Distinct().ToList();
            var packagesWithServices = await _context.Packages
                .Where(p => packageIds.Contains(p.Id))
                .Include(p => p.PackageServices)
                    .ThenInclude(ps => ps.Service)
                        .ThenInclude(s => s.ServiceProducts)
                            .ThenInclude(sp => sp.Product)
                .ToListAsync();

            var productUsage = new Dictionary<int, (string name, decimal quantity, string unit, decimal cost)>();
            foreach (var booking in bookings.Where(b => b.Status != BookingStatus.Cancelled))
            {
                foreach (var item in booking.BookingItems)
                {
                    var package = packagesWithServices.First(p => p.Id == item.PackageId);
                    foreach (var ps in package.PackageServices)
                    {
                        foreach (var sp in ps.Service.ServiceProducts)
                        {
                            var totalQuantity = sp.QuantityUsed * item.Quantity;
                            var totalCost     = totalQuantity * sp.Product.CostPerUnit;

                            if (productUsage.ContainsKey(sp.ProductId))
                            {
                                var cur = productUsage[sp.ProductId];
                                productUsage[sp.ProductId] = (cur.name, cur.quantity + totalQuantity, cur.unit, cur.cost + totalCost);
                            }
                            else
                            {
                                productUsage[sp.ProductId] = (sp.Product.Name, totalQuantity, sp.Product.Unit, totalCost);
                            }
                        }
                    }
                }
            }

            var topProducts = productUsage
                .Select(kvp => new ProductUsageDto
                {
                    ProductName       = kvp.Value.name,
                    TotalQuantityUsed = kvp.Value.quantity,
                    Unit              = kvp.Value.unit,
                    TotalCost         = kvp.Value.cost
                })
                .OrderByDescending(p => p.TotalCost)
                .Take(10)
                .ToList();

            return new OperationalReportDto
            {
                StartDate         = start,
                EndDate           = end,
                TotalBookings     = bookings.Count,
                CompletedBookings = bookings.Count(b => b.Status == BookingStatus.Completed),
                CancelledBookings = bookings.Count(b => b.Status == BookingStatus.Cancelled),
                PendingBookings   = bookings.Count(b => b.Status == BookingStatus.Pending),
                PackagePopularity = packagePopularity,
                TopProductsUsed   = topProducts,
                BookingsByStatus  = bookingsByStatus
            };
        }

        public async Task<PayrollReportDto> GetPayrollReportAsync(int month, int year)
        {
            var startDate = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            var endDate   = startDate.AddMonths(1);

            var workers = await _context.Staff
                .Where(s => s.IsActive && s.MonthlySalary.HasValue)
                .ToListAsync();

            var completedInRange = await _context.Bookings
                .Include(b => b.BookingItems)
                    .ThenInclude(i => i.Package)
                .Where(b => b.AssignedWorkerId != null
                         && b.WorkCompletedAt >= startDate
                         && b.WorkCompletedAt < endDate
                         && b.Status == BookingStatus.Completed)
                .ToListAsync();

            const int expectedMonthlyHours = 176;
            var employeePayrolls = new List<PayrollEmployeeDto>();

            foreach (var worker in workers)
            {
                var workerBookings = completedInRange.Where(b => b.AssignedWorkerId == worker.Id).ToList();
                var totalSeconds   = workerBookings.Sum(b => b.WorkDurationSeconds ?? 0);
                var hoursWorked    = totalSeconds / 3600.0;
                var hourlyRate     = (double)(worker.MonthlySalary!.Value / expectedMonthlyHours);
                var grossPay       = worker.MonthlySalary!.Value;
                var deductionRate  = grossPay > 5000m ? 0.02m : grossPay > 3000m ? 0.01m : 0.0m;
                var deductions     = grossPay * deductionRate;

                var jobDetails = workerBookings.Select(b => new PayrollJobDetail
                {
                    BookingId     = b.Id,
                    BookingNumber = b.BookingNumber ?? "",
                    CompletedAt   = b.WorkCompletedAt ?? b.ScheduledDate,
                    CustomerName  = b.CustomerName ?? "",
                    PackageName   = b.BookingItems.FirstOrDefault()?.Package?.Name ?? "Unknown",
                    VehicleType   = b.VehicleType.ToString(),
                    DurationHours = Math.Round((b.WorkDurationSeconds ?? 0) / 3600.0, 2),
                    Amount        = b.TotalAmount,
                    TipAmount     = b.TipAmount ?? 0m
                }).OrderByDescending(j => j.CompletedAt).ToList();

                employeePayrolls.Add(new PayrollEmployeeDto
                {
                    EmployeeId       = worker.Id,
                    EmployeeName     = $"{worker.FirstName} {worker.LastName}",
                    Role             = worker.Role,
                    MonthlySalary    = grossPay,
                    HoursWorked      = Math.Round(hoursWorked, 2),
                    HourlyRate       = Math.Round((decimal)hourlyRate, 2),
                    GrossPay         = grossPay,
                    Deductions       = deductions,
                    NetPay           = grossPay - deductions,
                    JobsCompleted    = workerBookings.Count,
                    RevenueGenerated = workerBookings.Sum(b => b.TotalAmount),
                    TotalTips        = workerBookings.Sum(b => b.TipAmount ?? 0m),
                    IsPaid           = worker.LastPaidMonth == month && worker.LastPaidYear == year,
                    PaidAt           = (worker.LastPaidMonth == month && worker.LastPaidYear == year) ? worker.LastPaidAt : null,
                    JobDetails       = jobDetails
                });
            }

            return new PayrollReportDto { Month = month, Year = year, Employees = employeePayrolls };
        }

        public async Task<(string? Error, string Message)> MarkPayrollPaidAsync(MarkPayrollPaidDto dto)
        {
            if (dto.EmployeeId > 0)
            {
                var worker = await _context.Staff.FirstOrDefaultAsync(s => s.Id == dto.EmployeeId);
                if (worker == null) return ("Worker not found", "");

                worker.LastPaidMonth = dto.Month;
                worker.LastPaidYear  = dto.Year;
                worker.LastPaidAt    = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return (null, $"Marked {worker.FirstName} {worker.LastName} as paid for {dto.Month}/{dto.Year}");
            }

            var workers = await _context.Staff.Where(s => s.IsActive && s.MonthlySalary.HasValue).ToListAsync();
            foreach (var worker in workers)
            {
                worker.LastPaidMonth = dto.Month;
                worker.LastPaidYear  = dto.Year;
                worker.LastPaidAt    = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();

            return (null, $"Marked all workers as paid for {dto.Month}/{dto.Year}");
        }
    }
}
