using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Helpers;
using Glanz.API.Models;
using Glanz.API.Modules.Auth;
using Glanz.API.Services;
using System.Text.Json;
using StaffModel = Glanz.API.Models.Staff;

namespace Glanz.API.Modules.Staff
{
    public class StaffService : IStaffService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IAuditService _audit;
        private readonly IAuthService _authService;

        public StaffService(
            AppDbContext context,
            IConfiguration configuration,
            IAuditService audit,
            IAuthService authService)
        {
            _context       = context;
            _configuration = configuration;
            _audit         = audit;
            _authService   = authService;
        }

        public async Task<(UserDto? Result, string? Error)> RegisterWorkerAsync(CreateWorkerDto dto, string? adminEmail)
        {
            if (await _context.Staff.AnyAsync(s => s.Email == dto.Email) ||
                await _context.Users.AnyAsync(u => u.Email == dto.Email))
                return (null, "Email already registered");

            if (!string.IsNullOrWhiteSpace(dto.ShortCode))
            {
                var code = dto.ShortCode.Trim().ToUpperInvariant();
                if (await _context.Staff.AnyAsync(s => s.ShortCode == code))
                    return (null, $"Short code '{code}' is already taken.");
            }

            var staff = new StaffModel
            {
                FirstName        = dto.FirstName,
                LastName         = dto.LastName,
                Email            = dto.Email,
                PasswordHash     = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Phone            = dto.Phone,
                ProfileImageUrl  = null,
                Role             = "Employee",
                StaffType        = string.IsNullOrWhiteSpace(dto.StaffType) ? "Detailer" : dto.StaffType,
                ShortCode        = string.IsNullOrWhiteSpace(dto.ShortCode) ? null : dto.ShortCode.Trim().ToUpperInvariant(),
                CompensationType = string.IsNullOrWhiteSpace(dto.CompensationType) ? "Salary" : dto.CompensationType,
                MonthlySalary    = dto.CompensationType == "Salary" ? dto.SalaryAmount : null,
                PercentageRate   = dto.CompensationType == "Percentage" ? dto.PercentageRate : null,
                SkillsJson       = dto.Skills != null && dto.Skills.Count > 0
                    ? JsonSerializer.Serialize(dto.Skills)
                    : null,
                IBAN             = string.IsNullOrWhiteSpace(dto.IBAN) ? null : dto.IBAN.Trim(),
                VanRole          = string.IsNullOrWhiteSpace(dto.VanRole) ? null : dto.VanRole.Trim(),
                DriverId         = dto.VanRole == "Helper" ? dto.DriverId : null,
                IsActive         = true,
                MustChangePassword = true,
                WorkingDays      = _configuration["BusinessSettings:DefaultWorkerWorkingDays"]
                    ?? "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
                ShiftStart       = _configuration["BusinessSettings:DefaultWorkerShiftStart"] ?? "08:00",
                ShiftEnd         = _configuration["BusinessSettings:DefaultWorkerShiftEnd"]   ?? "17:00",
                CreatedAt        = DateTime.UtcNow,
                UpdatedAt        = DateTime.UtcNow
            };

            _context.Staff.Add(staff);
            await _context.SaveChangesAsync();

            await _audit.LogAsync(
                action:     "WorkerCreated",
                userEmail:  adminEmail,
                entityType: "Staff",
                entityId:   staff.Id.ToString(),
                metadata:   new { staffEmail = staff.Email, staffType = staff.StaffType });

            return (_authService.ToUserDtoFromStaff(staff), null);
        }

        public async Task<IEnumerable<UserDto>> GetWorkersAsync()
        {
            var workers = await _context.Staff.OrderBy(s => s.FirstName).ThenBy(s => s.LastName).ToListAsync();
            return workers.Select(w => _authService.ToUserDtoFromStaff(w, workers));
        }

        public async Task<(UserDto? Result, string? Error)> UpdateWorkerVanRoleAsync(int id, UpdateWorkerVanRoleDto dto)
        {
            var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (staff == null) return (null, "Worker not found");

            var vanRole = string.IsNullOrWhiteSpace(dto.VanRole) ? null : dto.VanRole.Trim();

            if (vanRole == "Helper")
            {
                if (!dto.DriverId.HasValue)
                    return (null, "DriverId is required when VanRole is Helper.");
                var driverExists = await _context.Staff.AnyAsync(s => s.Id == dto.DriverId.Value && s.Id != id);
                if (!driverExists)
                    return (null, "Driver not found.");
            }

            staff.VanRole = vanRole;
            staff.DriverId = vanRole == "Helper" ? dto.DriverId : null;
            staff.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var allStaff = await _context.Staff.ToListAsync();
            return (_authService.ToUserDtoFromStaff(staff, allStaff), null);
        }

        public async Task<IEnumerable<object>> GetActiveWorkerNamesAsync()
        {
            return await _context.Staff
                .Where(s => s.IsActive)
                .OrderBy(s => s.FirstName).ThenBy(s => s.LastName)
                .Select(s => new { s.Id, s.FirstName, s.LastName })
                .ToListAsync<object>();
        }

        public async Task<(bool Available, string Normalized, List<string> Suggestions)> CheckShortCodeAsync(string code, int? excludeId)
        {
            var normalized = code.Trim().ToUpperInvariant();
            var query      = _context.Staff.Where(s => s.ShortCode == normalized);
            if (excludeId.HasValue) query = query.Where(s => s.Id != excludeId.Value);
            var taken      = await query.AnyAsync();

            var suggestions = new List<string>();
            if (taken)
            {
                for (int i = 1; suggestions.Count < 5; i++)
                {
                    var candidate = normalized.Length < 4 ? $"{normalized}{i}" : $"{normalized[..3]}{i}";
                    if (!await _context.Staff.AnyAsync(s => s.ShortCode == candidate))
                        suggestions.Add(candidate);
                    if (i > 20) break;
                }
            }
            return (!taken, normalized, suggestions);
        }

        public async Task<string> SuggestShortCodeAsync(string firstName, string lastName)
        {
            var existingCodes = await _context.Staff
                .Where(s => s.ShortCode != null)
                .Select(s => s.ShortCode!)
                .ToListAsync();
            return ShortCodeHelper.GenerateShortCode(firstName, lastName, existingCodes.ToHashSet());
        }

        public async Task<(UserDto? Result, string? Error)> UpdateWorkerScheduleAsync(int id, UpdateWorkerScheduleDto dto)
        {
            var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (staff == null) return (null, "Worker not found");

            staff.WorkingDays    = dto.WorkingDays.Trim();
            staff.ShiftStart     = dto.ShiftStart.Trim();
            staff.ShiftEnd       = dto.ShiftEnd.Trim();
            staff.DaySchedulesJson = (dto.DaySchedules != null && dto.DaySchedules.Count > 0)
                ? JsonSerializer.Serialize(dto.DaySchedules)
                : null;
            staff.UpdatedAt      = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (_authService.ToUserDtoFromStaff(staff), null);
        }

        public async Task<(UserDto? Result, string? Error)> UpdateWorkerStatusAsync(int id, UpdateWorkerStatusDto dto)
        {
            var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (staff == null) return (null, "Worker not found");

            staff.IsActive  = dto.IsActive;
            staff.UpdatedAt = DateTime.UtcNow;

            if (!dto.IsActive)
            {
                var assignedBookings = await _context.Bookings
                    .Where(b => b.AssignedWorkerId == staff.Id
                             && b.Status != BookingStatus.Completed
                             && b.Status != BookingStatus.Cancelled)
                    .ToListAsync();

                foreach (var booking in assignedBookings)
                {
                    booking.AssignedWorkerId = null;
                    booking.UpdatedAt        = DateTime.UtcNow;
                    if (booking.Status == BookingStatus.Confirmed)
                        booking.Status = BookingStatus.Pending;
                }
            }

            await _context.SaveChangesAsync();
            return (_authService.ToUserDtoFromStaff(staff), null);
        }

        public async Task<(UserDto? Result, string? Error)> UpdateWorkerSalaryAsync(int id, UpdateWorkerSalaryDto dto)
        {
            var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (staff == null) return (null, "Worker not found");

            staff.MonthlySalary = dto.MonthlySalary;
            staff.UpdatedAt     = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (_authService.ToUserDtoFromStaff(staff), null);
        }

        public async Task<(UserDto? Result, string? Error)> UpdateWorkerIbanAsync(int id, UpdateWorkerIbanDto dto)
        {
            var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (staff == null) return (null, "Worker not found");

            staff.IBAN      = string.IsNullOrWhiteSpace(dto.IBAN) ? null : dto.IBAN.Trim();
            staff.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (_authService.ToUserDtoFromStaff(staff), null);
        }

        public async Task<(List<object>? Conflicts, string? Error)> GetScheduleConflictsAsync(int staffId, string workingDays, string shiftStart, string shiftEnd)
        {
            var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Id == staffId);
            if (staff == null) return (null, "Worker not found");

            var proposedDays = workingDays.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var now = DateTime.UtcNow;
            var horizon = now.AddDays(30);

            var upcomingBookings = await _context.Bookings
                .Where(b => b.AssignedWorkerId == staffId
                    && b.ScheduledDate >= now && b.ScheduledDate <= horizon
                    && b.Status != Glanz.API.Models.BookingStatus.Cancelled
                    && b.Status != Glanz.API.Models.BookingStatus.Completed)
                .ToListAsync();

            var conflicts = new List<object>();
            foreach (var b in upcomingBookings)
            {
                var dayName = b.ScheduledDate.DayOfWeek.ToString();
                bool dayOk = proposedDays.Contains(dayName);
                bool timeOk = true;
                if (TimeSpan.TryParse(b.TimeSlot.Split('-')[0].Trim(), out var bookingStart)
                    && TimeSpan.TryParse(shiftStart, out var shift)
                    && TimeSpan.TryParse(shiftEnd, out var shiftE))
                {
                    timeOk = bookingStart >= shift && bookingStart < shiftE;
                }

                if (!dayOk || !timeOk)
                {
                    conflicts.Add(new
                    {
                        bookingNumber = b.BookingNumber,
                        scheduledDate = b.ScheduledDate,
                        timeSlot = b.TimeSlot,
                        issue = !dayOk ? $"{dayName} removed from working days" : $"Booking at {b.TimeSlot} outside new shift {shiftStart}-{shiftEnd}"
                    });
                }
            }

            return (conflicts, null);
        }

        public async Task<string?> DeleteWorkerAsync(int id)
        {
            var staff = await _context.Staff.FindAsync(id);
            if (staff == null) return "Worker not found";

            var workerBookings = await _context.Bookings.Where(b => b.AssignedWorkerId == id).ToListAsync();
            foreach (var b in workerBookings) b.AssignedWorkerId = null;
            await _context.SaveChangesAsync();

            _context.Staff.Remove(staff);
            await _context.SaveChangesAsync();
            return null;
        }

        public async Task<string?> SetAllowPreferredWorkerAsync(int userId, bool allow)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return "User not found.";

            user.AllowPreferredWorker = allow;
            user.UpdatedAt            = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return null;
        }

        // ── Attendance ────────────────────────────────────────────────────────────

        public async Task<(string? Error, string? Message, DateTime? ClockIn)> ClockInAsync(int staffId)
        {
            var today    = DateTime.UtcNow.Date;
            var existing = await _context.AttendanceLogs.FirstOrDefaultAsync(a => a.StaffId == staffId && a.ShiftDate == today);

            if (existing != null)
            {
                if (existing.ClockIn != null)
                    return ("Already clocked in for today.", null, existing.ClockIn);
                existing.ClockIn   = DateTime.UtcNow;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                _context.AttendanceLogs.Add(new Models.AttendanceLog
                {
                    StaffId   = staffId,
                    ShiftDate = today,
                    ClockIn   = DateTime.UtcNow,
                });
            }
            await _context.SaveChangesAsync();
            return (null, "Clocked in.", DateTime.UtcNow);
        }

        public async Task<(string? Error, DateTime? ClockIn, DateTime? ClockOut, int? DurationMinutes)> ClockOutAsync(int staffId, ClockOutDto dto)
        {
            var today = DateTime.UtcNow.Date;
            var log   = await _context.AttendanceLogs.FirstOrDefaultAsync(a => a.StaffId == staffId && a.ShiftDate == today);

            if (log == null || log.ClockIn == null)
                return ("No active clock-in found for today.", null, null, null);
            if (log.ClockOut != null)
                return ("Already clocked out today.", null, log.ClockOut, null);

            log.ClockOut  = DateTime.UtcNow;
            log.Note      = dto.Note?.Trim();
            log.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var duration = log.ClockOut.Value - log.ClockIn.Value;
            return (null, log.ClockIn, log.ClockOut, (int)duration.TotalMinutes);
        }

        public async Task<object> GetTodayAttendanceAsync(int staffId)
        {
            var today = DateTime.UtcNow.Date;
            var log   = await _context.AttendanceLogs.FirstOrDefaultAsync(a => a.StaffId == staffId && a.ShiftDate == today);
            return new
            {
                clockIn         = log?.ClockIn,
                clockOut        = log?.ClockOut,
                durationMinutes = (log?.ClockIn != null && log?.ClockOut != null)
                    ? (int?)(int)(log.ClockOut.Value - log.ClockIn.Value).TotalMinutes
                    : null,
            };
        }

        public async Task<IEnumerable<object>> GetAttendanceAsync(int? staffId, DateTime? from, DateTime? to)
        {
            var query = _context.AttendanceLogs.Include(a => a.Staff).AsQueryable();
            if (staffId.HasValue) query = query.Where(a => a.StaffId == staffId);
            if (from.HasValue)    query = query.Where(a => a.ShiftDate >= from.Value.Date);
            if (to.HasValue)      query = query.Where(a => a.ShiftDate <= to.Value.Date);

            var logs = await query.OrderByDescending(a => a.ShiftDate).ToListAsync();
            return logs.Select(a => (object)new
            {
                id              = a.Id,
                staffId         = a.StaffId,
                staffName       = $"{a.Staff?.FirstName} {a.Staff?.LastName}".Trim(),
                shiftDate       = a.ShiftDate,
                clockIn         = a.ClockIn,
                clockOut        = a.ClockOut,
                durationMinutes = (a.ClockIn != null && a.ClockOut != null)
                    ? (int?)(int)(a.ClockOut.Value - a.ClockIn.Value).TotalMinutes
                    : null,
                note            = a.Note,
            });
        }

        // ── Payroll ───────────────────────────────────────────────────────────────

        public async Task<List<WorkerPayrollSummaryDto>> GetPayrollSummaryAsync(int? month, int? year)
        {
            var targetMonth = month ?? DateTime.UtcNow.Month;
            var targetYear  = year  ?? DateTime.UtcNow.Year;
            var periodStart = new DateTime(targetYear, targetMonth, 1, 0, 0, 0, DateTimeKind.Utc);
            var periodEnd   = periodStart.AddMonths(1);

            var workers = await _context.Staff.Where(s => s.IsActive).ToListAsync();

            var completedBookings = await _context.Bookings
                .Where(b => b.AssignedWorkerId != null
                         && b.Status == BookingStatus.Completed
                         && b.WorkCompletedAt >= periodStart
                         && b.WorkCompletedAt < periodEnd)
                .Select(b => new { b.AssignedWorkerId, b.TotalAmount })
                .ToListAsync();

            var attendanceLogs = await _context.AttendanceLogs
                .Where(a => a.ShiftDate >= periodStart && a.ShiftDate < periodEnd
                         && a.ClockIn != null && a.ClockOut != null)
                .Select(a => new { a.StaffId, a.ShiftDate, a.ClockIn, a.ClockOut })
                .ToListAsync();

            return workers.Select(w =>
            {
                var jobs    = completedBookings.Where(b => b.AssignedWorkerId == w.Id).ToList();
                var revenue = jobs.Sum(b => b.TotalAmount);
                var isPaid  = w.LastPaidMonth == targetMonth && w.LastPaidYear == targetYear;

                var workerLogs   = attendanceLogs.Where(a => a.StaffId == w.Id).ToList();
                var daysPresent  = workerLogs.Select(a => a.ShiftDate.Date).Distinct().Count();
                var totalMinutes = workerLogs.Sum(a => a.ClockIn.HasValue && a.ClockOut.HasValue
                                     ? (int)(a.ClockOut.Value - a.ClockIn.Value).TotalMinutes : 0);

                decimal estimatedSalary;
                if (w.CompensationType == "Percentage")
                {
                    estimatedSalary = w.PercentageRate.HasValue ? Math.Round(revenue * w.PercentageRate.Value / 100m, 2) : 0m;
                }
                else
                {
                    var fullSalary = w.MonthlySalary ?? 0m;
                    if (totalMinutes > 0 && fullSalary > 0)
                    {
                        double shiftHours = 8.0;
                        if (!string.IsNullOrWhiteSpace(w.ShiftStart) && !string.IsNullOrWhiteSpace(w.ShiftEnd)
                            && TimeSpan.TryParse(w.ShiftStart, out var shiftStartTs)
                            && TimeSpan.TryParse(w.ShiftEnd, out var shiftEndTs)
                            && shiftEndTs > shiftStartTs)
                        {
                            shiftHours = (shiftEndTs - shiftStartTs).TotalHours;
                        }
                        var workingDaysInMonth = CountWorkingDays(w.WorkingDays, periodStart, periodEnd);
                        var expectedMinutes    = workingDaysInMonth * shiftHours * 60.0;
                        estimatedSalary = expectedMinutes > 0
                            ? Math.Round(fullSalary * ((decimal)totalMinutes / (decimal)expectedMinutes), 2)
                            : fullSalary;
                    }
                    else
                    {
                        estimatedSalary = fullSalary;
                    }
                }

                return new WorkerPayrollSummaryDto
                {
                    WorkerId           = w.Id,
                    WorkerName         = $"{w.FirstName} {w.LastName}",
                    CompensationType   = w.CompensationType,
                    MonthlySalary      = w.MonthlySalary,
                    PercentageRate     = w.PercentageRate,
                    Month              = targetMonth,
                    Year               = targetYear,
                    JobsCompleted      = jobs.Count,
                    TotalRevenue       = revenue,
                    EstimatedSalary    = estimatedSalary,
                    TotalMinutesWorked = totalMinutes > 0 ? totalMinutes : null,
                    DaysPresent        = daysPresent > 0 ? daysPresent : null,
                    IsPaid             = isPaid,
                    PaidAt             = isPaid ? w.LastPaidAt : null,
                };
            }).ToList();
        }

        public async Task<string?> MarkWorkerPaidAsync(MarkWorkerPaidDto dto)
        {
            var staff = await _context.Staff.FindAsync(dto.WorkerId);
            if (staff == null) return "Worker not found";

            staff.LastPaidMonth = dto.Month;
            staff.LastPaidYear  = dto.Year;
            staff.LastPaidAt    = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return null;
        }

        public async Task<int> GetUnpaidCountAsync()
        {
            var currentMonth = DateTime.UtcNow.Month;
            var currentYear  = DateTime.UtcNow.Year;
            return await _context.Staff
                .Where(s => s.IsActive && s.MonthlySalary != null)
                .Where(s => !(s.LastPaidMonth == currentMonth && s.LastPaidYear == currentYear))
                .CountAsync();
        }

        public async Task<object> CheckPayrollDueAsync()
        {
            var currentMonth  = DateTime.UtcNow.Month;
            var currentYear   = DateTime.UtcNow.Year;
            var today         = DateTime.UtcNow.Day;

            var unpaidWorkers = await _context.Staff
                .Where(s => s.IsActive && s.MonthlySalary != null)
                .Where(s => !(s.LastPaidMonth == currentMonth && s.LastPaidYear == currentYear))
                .Select(s => new { s.FirstName, s.LastName, s.MonthlySalary })
                .ToListAsync();

            if (unpaidWorkers.Count == 0)
                return new { message = "All workers are paid", hasUnpaid = false };

            const int dueDate = 25;
            if (today >= dueDate)
            {
                var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Role == "Admin");
                if (adminUser != null)
                {
                    var totalDue = unpaidWorkers.Sum(w => w.MonthlySalary ?? 0);
                    var periodStart = new DateTime(currentYear, currentMonth, 1);
                    var existingNotif = await _context.Notifications
                        .Where(n => n.AdminId == adminUser.Id && n.Type == NotificationType.PayrollDue && n.CreatedAt >= periodStart)
                        .FirstOrDefaultAsync();

                    if (existingNotif == null)
                    {
                        _context.Notifications.Add(new Notification
                        {
                            AdminId   = adminUser.Id,
                            Type      = NotificationType.PayrollDue,
                            Message   = $"Payroll due: {unpaidWorkers.Count} worker(s) unpaid. Total: QAR {totalDue:N0}. Please process payments by end of month.",
                            CreatedAt = DateTime.UtcNow
                        });
                        await _context.SaveChangesAsync();
                    }
                }
            }

            return new
            {
                hasUnpaid   = true,
                unpaidCount = unpaidWorkers.Count,
                totalAmount = unpaidWorkers.Sum(w => w.MonthlySalary ?? 0)
            };
        }

        public async Task<object> GetPaySlipSettingsAsync()
        {
            var keys = new[] { "payslip.companyName", "payslip.companyLogo", "payslip.companyAddress", "payslip.companyPhone", "payslip.companyEmail", "payslip.footerText" };
            var rows = await _context.SystemSettings.Where(s => keys.Contains(s.Key)).ToListAsync();

            string? Get(string key) => rows.FirstOrDefault(r => r.Key == key)?.Value;

            return new
            {
                companyName    = Get("payslip.companyName")    ?? "Glanz",
                companyLogo    = Get("payslip.companyLogo")    ?? "",
                companyAddress = Get("payslip.companyAddress") ?? "",
                companyPhone   = Get("payslip.companyPhone")   ?? "",
                companyEmail   = Get("payslip.companyEmail")   ?? "",
                footerText     = Get("payslip.footerText")     ?? ""
            };
        }

        public async Task UpdatePaySlipSettingsAsync(PaySlipSettingsDto dto)
        {
            var updates = new List<(string Key, string Value)>();
            if (dto.CompanyName    != null) updates.Add(("payslip.companyName",    dto.CompanyName.Trim()));
            if (dto.CompanyLogo    != null) updates.Add(("payslip.companyLogo",    dto.CompanyLogo ?? ""));
            if (dto.CompanyAddress != null) updates.Add(("payslip.companyAddress", dto.CompanyAddress.Trim()));
            if (dto.CompanyPhone   != null) updates.Add(("payslip.companyPhone",   dto.CompanyPhone.Trim()));
            if (dto.CompanyEmail   != null) updates.Add(("payslip.companyEmail",   dto.CompanyEmail.Trim()));
            if (dto.FooterText     != null) updates.Add(("payslip.footerText",     dto.FooterText.Trim()));

            foreach (var (key, value) in updates)
            {
                var existing = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
                if (existing != null)
                {
                    existing.Value     = value;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _context.SystemSettings.Add(new SystemSetting { Key = key, Value = value, UpdatedAt = DateTime.UtcNow });
                }
            }
            await _context.SaveChangesAsync();
        }

        // ── Private helpers ───────────────────────────────────────────────────────

        private static int CountWorkingDays(string? workingDaysStr, DateTime periodStart, DateTime periodEnd)
        {
            var dayNames = string.IsNullOrWhiteSpace(workingDaysStr)
                ? new HashSet<string> { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday" }
                : workingDaysStr.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                .Select(d => d.Trim())
                                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            int count = 0;
            for (var d = periodStart.Date; d < periodEnd.Date; d = d.AddDays(1))
                if (dayNames.Contains(d.DayOfWeek.ToString())) count++;
            return count;
        }
    }
}
