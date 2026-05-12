using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ReportsController : ControllerBase
    {
        private readonly AppDbContext _context;

        private static DateTime NormalizeUtc(DateTime value) => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

        public ReportsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("dashboard-summary")]
        public async Task<ActionResult<DashboardSummaryDto>> GetDashboardSummary(
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            try
            {
                var now = DateTime.UtcNow;
                var windowEnd = NormalizeUtc(endDate ?? now);
                var windowStart = NormalizeUtc(startDate ?? new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc));

                var totalBookings = await _context.Bookings.CountAsync();
                var pendingBookings = await _context.Bookings.CountAsync(b => b.Status == BookingStatus.Pending);
                var completedBookings = await _context.Bookings.CountAsync(b => b.Status == BookingStatus.Completed);
                var activeCustomers = await _context.Users.CountAsync(u => u.IsActive && u.Role == "Customer");
                var activePackages = await _context.Packages.CountAsync(p => p.IsActive);
                var activeServices = await _context.Services.CountAsync(s => s.IsActive);
                var activeProducts = await _context.Products.CountAsync(p => p.IsActive);
                var recentBookings = await _context.Bookings.CountAsync(b => b.CreatedAt >= windowStart && b.CreatedAt <= windowEnd);
                var recentRevenue = await _context.Bookings
                    .Where(b => b.CreatedAt >= windowStart && b.CreatedAt <= windowEnd && b.Status != BookingStatus.Cancelled)
                    .SumAsync(b => (decimal?)b.TotalAmount) ?? 0m;
                var lifetimeRevenue = await _context.Bookings
                    .Where(b => b.Status != BookingStatus.Cancelled)
                    .SumAsync(b => (decimal?)b.TotalAmount) ?? 0m;

                return Ok(new DashboardSummaryDto
                {
                    WindowStart = windowStart,
                    WindowEnd = windowEnd,
                    TotalBookings = totalBookings,
                    PendingBookings = pendingBookings,
                    CompletedBookings = completedBookings,
                    ActiveCustomers = activeCustomers,
                    ActivePackages = activePackages,
                    ActiveServices = activeServices,
                    ActiveProducts = activeProducts,
                    RecentBookings = recentBookings,
                    RecentRevenue = recentRevenue,
                    LifetimeRevenue = lifetimeRevenue
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error generating dashboard summary: {ex.Message}");
                return StatusCode(500, new { message = "Failed to generate dashboard summary" });
            }
        }

        [HttpGet("financial")]
        public async Task<ActionResult<FinancialReportDto>> GetFinancialReport(
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            try
            {
                var start = NormalizeUtc(startDate ?? DateTime.UtcNow.AddDays(-30));
                var end = NormalizeUtc(endDate ?? DateTime.UtcNow);

                var bookings = await _context.Bookings
                    .Where(b => b.CreatedAt >= start && b.CreatedAt <= end && b.Status != BookingStatus.Cancelled)
                    .ToListAsync();

                var totalRevenue = bookings.Sum(b => b.TotalAmount);
                var totalCost = bookings.Sum(b => b.EstimatedCost);
                var totalProfit = totalRevenue - totalCost;
                var profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

                var dailyBreakdown = bookings
                    .GroupBy(b => b.ScheduledDate.Date)
                    .Select(g => new DailyFinancialDto
                    {
                        Date = g.Key,
                        Revenue = g.Sum(b => b.TotalAmount),
                        Cost = g.Sum(b => b.EstimatedCost),
                        Profit = g.Sum(b => b.TotalAmount - b.EstimatedCost),
                        BookingCount = g.Count()
                    })
                    .OrderBy(d => d.Date)
                    .ToList();

                // ── Per-service margins ──────────────────────────────────────────
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
                    var booking = bookings.First(b => b.Id == item.BookingId);
                    var itemRevenue  = item.Price * item.Quantity;
                    var serviceCount = item.Package?.PackageServices?.Count ?? 1;

                    foreach (var ps in item.Package?.PackageServices ?? new List<PackageService>())
                    {
                        var svcName = ps.Service?.Name ?? "Unknown";
                        var key = $"{svcName}||{item.Package?.Name ?? ""}";
                        var svcCost = (ps.Service?.ServiceProducts ?? new List<ServiceProduct>())
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
                        var parts   = kvp.Key.Split("||");
                        var svcName = parts[0];
                        var profit  = kvp.Value.rev - kvp.Value.cost;
                        var margin  = kvp.Value.rev > 0 ? (profit / kvp.Value.rev) * 100 : 0;
                        return new ServiceMarginDto
                        {
                            ServiceName    = svcName,
                            PackageName    = kvp.Value.package,
                            JobCount       = kvp.Value.count,
                            TotalRevenue   = Math.Round(kvp.Value.rev,  2),
                            TotalCost      = Math.Round(kvp.Value.cost, 2),
                            TotalProfit    = Math.Round(profit, 2),
                            MarginPercent  = Math.Round(margin, 1),
                        };
                    })
                    .OrderByDescending(s => s.TotalRevenue)
                    .ToList();

                // ── Outstanding payments ─────────────────────────────────────────
                var outstandingBookings = await _context.Bookings
                    .Where(b => b.Status != BookingStatus.Cancelled
                             && (b.PaymentStatus == PaymentStatus.PreAuthorized || b.PaymentStatus == PaymentStatus.Failed))
                    .OrderBy(b => b.ScheduledDate)
                    .Select(b => new OutstandingPaymentDto
                    {
                        BookingId      = b.Id,
                        BookingNumber  = b.BookingNumber,
                        CustomerName   = b.CustomerName,
                        Amount         = b.TotalAmount,
                        PaymentStatus  = b.PaymentStatus.ToString(),
                        BookingStatus  = b.Status.ToString(),
                        ScheduledDate  = b.ScheduledDate,
                    })
                    .ToListAsync();

                var report = new FinancialReportDto
                {
                    StartDate = start,
                    EndDate = end,
                    TotalRevenue = totalRevenue,
                    TotalCost = totalCost,
                    TotalProfit = totalProfit,
                    ProfitMarginPercent = profitMargin,
                    TotalBookings = bookings.Count,
                    AverageBookingValue = bookings.Count > 0 ? totalRevenue / bookings.Count : 0,
                    DailyBreakdown = dailyBreakdown,
                    ServiceMargins = serviceMargins,
                    OutstandingPayments = outstandingBookings,
                    OutstandingTotal = outstandingBookings.Sum(p => p.Amount),
                };

                return Ok(report);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error generating financial report: {ex.Message}");
                return StatusCode(500, new { message = "Failed to generate financial report" });
            }
        }

        [HttpGet("operational")]
        public async Task<ActionResult<OperationalReportDto>> GetOperationalReport(
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            try
            {
                var start = NormalizeUtc(startDate ?? DateTime.UtcNow.AddDays(-30));
                var end = NormalizeUtc(endDate ?? DateTime.UtcNow);

                var bookings = await _context.Bookings
                    .Where(b => b.CreatedAt >= start && b.CreatedAt <= end)
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .ToListAsync();

                var totalBookings = bookings.Count;
                var completedBookings = bookings.Count(b => b.Status == BookingStatus.Completed);
                var cancelledBookings = bookings.Count(b => b.Status == BookingStatus.Cancelled);
                var pendingBookings = bookings.Count(b => b.Status == BookingStatus.Pending);

                var bookingsByStatus = bookings
                    .GroupBy(b => b.Status.ToString())
                    .ToDictionary(g => g.Key, g => g.Count());

                var packagePopularity = bookings
                    .SelectMany(b => b.BookingItems)
                    .GroupBy(bi => new { bi.PackageId, bi.Package.Name, bi.Package.Tier })
                    .Select(g => new PackagePopularityDto
                    {
                        PackageName = g.Key.Name,
                        Tier = g.Key.Tier,
                        BookingCount = g.Sum(bi => bi.Quantity),
                        TotalRevenue = g.Sum(bi => bi.Price * bi.Quantity)
                    })
                    .OrderByDescending(p => p.BookingCount)
                    .ToList();

                // Get product usage
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
                                var totalCost = totalQuantity * sp.Product.CostPerUnit;

                                if (productUsage.ContainsKey(sp.ProductId))
                                {
                                    var current = productUsage[sp.ProductId];
                                    productUsage[sp.ProductId] = (
                                        current.name,
                                        current.quantity + totalQuantity,
                                        current.unit,
                                        current.cost + totalCost
                                    );
                                }
                                else
                                {
                                    productUsage[sp.ProductId] = (
                                        sp.Product.Name,
                                        totalQuantity,
                                        sp.Product.Unit,
                                        totalCost
                                    );
                                }
                            }
                        }
                    }
                }

                var topProducts = productUsage
                    .Select(kvp => new ProductUsageDto
                    {
                        ProductName = kvp.Value.name,
                        TotalQuantityUsed = kvp.Value.quantity,
                        Unit = kvp.Value.unit,
                        TotalCost = kvp.Value.cost
                    })
                    .OrderByDescending(p => p.TotalCost)
                    .Take(10)
                    .ToList();

                var report = new OperationalReportDto
                {
                    StartDate = start,
                    EndDate = end,
                    TotalBookings = totalBookings,
                    CompletedBookings = completedBookings,
                    CancelledBookings = cancelledBookings,
                    PendingBookings = pendingBookings,
                    PackagePopularity = packagePopularity,
                    TopProductsUsed = topProducts,
                    BookingsByStatus = bookingsByStatus
                };

                return Ok(report);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error generating operational report: {ex.Message}");
                return StatusCode(500, new { message = "Failed to generate operational report" });
            }
        }

        [HttpGet("payroll")]
        public async Task<ActionResult<PayrollReportDto>> GetPayrollReport([FromQuery] int month, [FromQuery] int year)
        {
            try
            {
                var startDate = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
                var endDate = startDate.AddMonths(1);

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

                var employeePayrolls = new List<PayrollEmployeeDto>();
                const int expectedMonthlyHours = 176;

                foreach (var worker in workers)
                {
                    var workerBookings = completedInRange.Where(b => b.AssignedWorkerId == worker.Id).ToList();
                    var totalSeconds = workerBookings.Sum(b => b.WorkDurationSeconds ?? 0);
                    var hoursWorked = totalSeconds / 3600.0;
                    var hourlyRate = (double)(worker.MonthlySalary!.Value / expectedMonthlyHours);
                    var jobsCompleted = workerBookings.Count;

                    var jobDetails = workerBookings.Select(b =>
                    {
                        var packageName = b.BookingItems.FirstOrDefault()?.Package?.Name ?? "Unknown";
                        var durationHours = (b.WorkDurationSeconds ?? 0) / 3600.0;
                        return new PayrollJobDetail
                        {
                            BookingId = b.Id,
                            BookingNumber = b.BookingNumber ?? "",
                            CompletedAt = b.WorkCompletedAt ?? b.ScheduledDate,
                            CustomerName = b.CustomerName ?? "",
                            PackageName = packageName,
                            VehicleType = b.VehicleType.ToString(),
                            DurationHours = Math.Round(durationHours, 2),
                            Amount = b.TotalAmount
                        };
                    }).OrderByDescending(j => j.CompletedAt).ToList();

                    var grossPay = worker.MonthlySalary!.Value;
                    var deductionRate = 0.0m;
                    if (grossPay > 5000m) deductionRate = 0.02m;
                    else if (grossPay > 3000m) deductionRate = 0.01m;
                    var deductions = grossPay * deductionRate;
                    var netPay = grossPay - deductions;

                    employeePayrolls.Add(new PayrollEmployeeDto
                    {
                        EmployeeId = worker.Id,
                        EmployeeName = $"{worker.FirstName} {worker.LastName}",
                        Role = worker.Role,
                        MonthlySalary = worker.MonthlySalary!.Value,
                        HoursWorked = Math.Round(hoursWorked, 2),
                        HourlyRate = Math.Round((decimal)hourlyRate, 2),
                        GrossPay = grossPay,
                        Deductions = deductions,
                        NetPay = netPay,
                        JobsCompleted = jobsCompleted,
                        RevenueGenerated = workerBookings.Sum(b => b.TotalAmount),
                        IsPaid = worker.LastPaidMonth == month && worker.LastPaidYear == year,
                        PaidAt = (worker.LastPaidMonth == month && worker.LastPaidYear == year) ? worker.LastPaidAt : null,
                        JobDetails = jobDetails
                    });
                }

                var report = new PayrollReportDto
                {
                    Month = month,
                    Year = year,
                    Employees = employeePayrolls
                };

                return Ok(report);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error generating payroll report: {ex.Message}");
                return StatusCode(500, new { message = "Failed to generate payroll report" });
            }
        }

        [HttpPost("payroll/mark-paid")]
        public async Task<ActionResult> MarkPayrollPaid([FromBody] MarkPayrollPaidDto dto)
        {
            try
            {
                if (dto.EmployeeId > 0)
                {
                    var worker = await _context.Staff.FirstOrDefaultAsync(s => s.Id == dto.EmployeeId);
                    if (worker == null)
                        return NotFound(new { message = "Worker not found" });

                    worker.LastPaidMonth = dto.Month;
                    worker.LastPaidYear = dto.Year;
                    worker.LastPaidAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    return Ok(new { message = $"Marked {worker.FirstName} {worker.LastName} as paid for {dto.Month}/{dto.Year}" });
                }

                var workers = await _context.Staff.Where(s => s.IsActive && s.MonthlySalary.HasValue).ToListAsync();
                foreach (var worker in workers)
                {
                    worker.LastPaidMonth = dto.Month;
                    worker.LastPaidYear = dto.Year;
                    worker.LastPaidAt = DateTime.UtcNow;
                }
                await _context.SaveChangesAsync();

                return Ok(new { message = $"Marked all workers as paid for {dto.Month}/{dto.Year}" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error marking payroll paid: {ex.Message}");
                return StatusCode(500, new { message = "Failed to mark payroll as paid" });
            }
        }
    }
}