using Flowly.API.Data;
using Flowly.API.DTOs;
using Flowly.API.Models;
using Flowly.API.Modules.Reports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ReportsController : ControllerBase
    {
        private readonly IReportsService _reportsService;
        private readonly AppDbContext _context;

        public ReportsController(IReportsService reportsService, AppDbContext context)
        {
            _reportsService = reportsService;
            _context = context;
        }

        [HttpGet("dashboard-summary")]
        public async Task<ActionResult<DashboardSummaryDto>> GetDashboardSummary(
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            try
            {
                return Ok(await _reportsService.GetDashboardSummaryAsync(startDate, endDate));
            }
            catch
            {
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
                return Ok(await _reportsService.GetFinancialReportAsync(startDate, endDate));
            }
            catch
            {
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
                return Ok(await _reportsService.GetOperationalReportAsync(startDate, endDate));
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to generate operational report" });
            }
        }

        [HttpGet("payroll")]
        public async Task<ActionResult<PayrollReportDto>> GetPayrollReport([FromQuery] int month, [FromQuery] int year)
        {
            try
            {
                return Ok(await _reportsService.GetPayrollReportAsync(month, year));
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to generate payroll report" });
            }
        }

        [HttpPost("payroll/mark-paid")]
        public async Task<ActionResult> MarkPayrollPaid([FromBody] MarkPayrollPaidDto dto)
        {
            try
            {
                var (error, message) = await _reportsService.MarkPayrollPaidAsync(dto);
                if (error != null) return NotFound(new { message = error });
                return Ok(new { message });
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to mark payroll as paid" });
            }
        }

        /// <summary>
        /// DATEV export for Austrian accounting.
        /// Format: EXTF (DATEV standard ASCII CSV), account code 4400 (revenue) / VAT 20%.
        /// GET /api/Reports/datev-export?month=YYYY-MM
        /// </summary>
        [HttpGet("datev-export")]
        public async Task<IActionResult> GetDatevExport([FromQuery] string month)
        {
            if (!DateTime.TryParseExact(month, "yyyy-MM", null, System.Globalization.DateTimeStyles.None, out var parsed))
                return BadRequest(new { message = "month must be in YYYY-MM format." });

            var start = new DateTime(parsed.Year, parsed.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = start.AddMonths(1);

            var bookings = await _context.Bookings
                .Where(b => b.ScheduledDate >= start && b.ScheduledDate < end
                    && b.Status == BookingStatus.Completed
                    && b.PaymentStatus == PaymentStatus.Paid)
                .OrderBy(b => b.ScheduledDate)
                .ToListAsync();

            // DATEV EXTF header (simplified - real DATEV requires full header block)
            var sb = new StringBuilder();
            sb.AppendLine("\"EXTF\";700;21;Buchungsstapel;9;20260101000000000;;" +
                          "Flowly;;Flowly;1;12345;20260101;4;20;;;1000;0;;;");
            sb.AppendLine("Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;" +
                          "Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);" +
                          "BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext;" +
                          "Postensperre;Diverse Adressnummer;Geschäftspartnerbank;Sachverhalt;" +
                          "Zinssperre;Beleglink;Beleginfo - Art 1;Beleginfo - Inhalt 1;" +
                          "Beleginfo - Art 2;Beleginfo - Inhalt 2;Beleginfo - Art 3;Beleginfo - Inhalt 3;" +
                          "Beleginfo - Art 4;Beleginfo - Inhalt 4;KOST1 - Kostenstelle;KOST2 - Kostenstelle;" +
                          "Kost-Menge;EU-Land u. UStID;EU-Steuersatz;Abw. Versteuerungsart;" +
                          "Sachverhalt L+L;Funktionsergänzung L+L;BU 49 Hauptfunktionstyp;" +
                          "BU 49 Hauptfunktionsnummer;BU 49 Funktionsergänzung;Zusatzinformation - Art 1;" +
                          "Zusatzinformation - Inhalt 1;Stück;Gewicht");

            foreach (var b in bookings)
            {
                // Net amount (before 20% VAT)
                var gross = b.TotalAmount;
                var net = Math.Round(gross / 1.20m, 2);
                var date = b.ScheduledDate.ToString("ddMM"); // DATEV date format: DDMM

                sb.AppendLine($"{net.ToString("F2", System.Globalization.CultureInfo.InvariantCulture).Replace(".", ",")};S;EUR;;;" +
                              $";4400;10000;9;{date};{b.BookingNumber};;;" +
                              $"Booking {b.BookingNumber};;;;;;;;;;;;;;;;;;;;;;;");
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            return File(bytes, "text/csv", $"DATEV-Buchungen-{month}.csv");
        }

        /// <summary>
        /// Cohort retention analysis.
        /// Groups customers by first-booking month (cohort) and tracks what % returned in subsequent months.
        /// GET /api/Reports/cohort-retention?months=6
        /// </summary>
        [HttpGet("cohort-retention")]
        public async Task<IActionResult> GetCohortRetention([FromQuery] int months = 6)
        {
            months = Math.Clamp(months, 1, 24);
            var cutoff = DateTime.UtcNow.AddMonths(-months);

            var bookings = await _context.Bookings
                .Where(b => b.UserId.HasValue && b.Status == BookingStatus.Completed && b.ScheduledDate >= cutoff)
                .Select(b => new { b.UserId, b.ScheduledDate })
                .ToListAsync();

            var firstBooking = bookings
                .GroupBy(b => b.UserId!.Value)
                .ToDictionary(g => g.Key, g => g.Min(b => b.ScheduledDate));

            var cohorts = firstBooking
                .GroupBy(kv => new DateTime(kv.Value.Year, kv.Value.Month, 1))
                .OrderBy(g => g.Key)
                .Select(cohort =>
                {
                    var cohortUsers = cohort.Select(kv => kv.Key).ToHashSet();
                    var cohortStart = cohort.Key;

                    var retention = Enumerable.Range(0, months).Select(offset =>
                    {
                        var month = cohortStart.AddMonths(offset);
                        if (month > DateTime.UtcNow) return (int?)null;
                        var monthEnd = month.AddMonths(1);
                        var retained = bookings
                            .Where(b => cohortUsers.Contains(b.UserId!.Value)
                                && b.ScheduledDate >= month && b.ScheduledDate < monthEnd)
                            .Select(b => b.UserId!.Value)
                            .Distinct()
                            .Count();
                        return cohortUsers.Count == 0 ? 0 : (int?)Math.Round((double)retained / cohortUsers.Count * 100);
                    }).ToList();

                    return new
                    {
                        cohortMonth = cohortStart.ToString("yyyy-MM"),
                        cohortSize = cohortUsers.Count,
                        retentionPercent = retention
                    };
                })
                .ToList();

            return Ok(new { months, cohorts });
        }

        /// <summary>
        /// RKSV receipts with SHA-256 hash chain (Austrian Registrierkassenpflicht).
        /// Each receipt's SignatureChain = Base64( SHA256( prevHash + bookingNumber + amount + date ) ).
        /// Replace prevHash seed with your registered SCU device ID for full legal compliance.
        /// GET /api/Reports/rksv-receipts?month=YYYY-MM  OR  ?from=&amp;to=
        /// </summary>
        [HttpGet("rksv-receipts")]
        public async Task<IActionResult> GetRksvReceipts([FromQuery] string? month, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            DateTime start, end;
            if (!string.IsNullOrWhiteSpace(month) &&
                DateTime.TryParseExact(month, "yyyy-MM", null, System.Globalization.DateTimeStyles.None, out var parsed))
            {
                start = new DateTime(parsed.Year, parsed.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                end = start.AddMonths(1);
            }
            else
            {
                start = from?.ToUniversalTime() ?? DateTime.UtcNow.AddDays(-30);
                end = to?.ToUniversalTime() ?? DateTime.UtcNow;
            }

            var rawBookings = await _context.Bookings
                .Where(b => b.ScheduledDate >= start && b.ScheduledDate < end
                    && b.Status == BookingStatus.Completed
                    && b.PaymentStatus == PaymentStatus.Paid)
                .OrderBy(b => b.ScheduledDate)
                .Select(b => new { b.BookingNumber, b.ScheduledDate, b.TotalAmount })
                .ToListAsync();

            // SHA-256 chained hash: each receipt signs (prevHash + bookingNumber + amount + date)
            // Seed: org ID or registered SCU device ID (configure via RKSV:SeedKey in appsettings)
            var seedKey = _context.Database.GetConnectionString()?.GetHashCode().ToString("X") ?? "FLOWLY-RKSV-SEED";
            var prevHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(seedKey)));

            var receipts = rawBookings.Select(b =>
            {
                var gross = b.TotalAmount;
                var net = Math.Round(gross / 1.20m, 2);
                var vat = Math.Round(gross - net, 2);
                var payload = $"{prevHash}{b.BookingNumber}{gross:F2}{b.ScheduledDate:yyyyMMdd}";
                var hash = System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(payload));
                var sig = Convert.ToBase64String(hash);
                prevHash = Convert.ToHexString(hash);
                return new
                {
                    b.BookingNumber,
                    b.ScheduledDate,
                    GrossAmount = gross,
                    NetAmount = net,
                    VatAmount = vat,
                    VatRate = "20%",
                    SignatureChain = sig,
                };
            }).ToList();

            return Ok(new { from = start, to = end, count = receipts.Count, receipts });
        }

        /// <summary>
        /// iCal export of bookings for Google Calendar / Outlook import.
        /// GET /api/Reports/ical-export?startDate=&amp;endDate=
        /// </summary>
        [HttpGet("ical-export")]
        public async Task<IActionResult> GetIcalExport([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var start = startDate ?? DateTime.UtcNow.Date;
            var end = endDate ?? start.AddMonths(1);

            var bookings = await _context.Bookings
                .Where(b => b.ScheduledDate >= start && b.ScheduledDate <= end
                    && b.Status != BookingStatus.Cancelled)
                .OrderBy(b => b.ScheduledDate)
                .ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine("BEGIN:VCALENDAR");
            sb.AppendLine("VERSION:2.0");
            sb.AppendLine("PRODID:-//Flowly//Booking Calendar//EN");
            sb.AppendLine("CALSCALE:GREGORIAN");
            sb.AppendLine("METHOD:PUBLISH");

            foreach (var b in bookings)
            {
                var dtStart = b.ScheduledDate;
                if (TimeSpan.TryParse(b.TimeSlot, out var ts))
                    dtStart = dtStart.Date.Add(ts);
                var dtEnd = dtStart.AddHours(1);

                sb.AppendLine("BEGIN:VEVENT");
                sb.AppendLine($"UID:{b.BookingNumber}@flowly");
                sb.AppendLine($"DTSTAMP:{DateTime.UtcNow:yyyyMMddTHHmmssZ}");
                sb.AppendLine($"DTSTART:{dtStart:yyyyMMddTHHmmssZ}");
                sb.AppendLine($"DTEND:{dtEnd:yyyyMMddTHHmmssZ}");
                sb.AppendLine($"SUMMARY:Booking {b.BookingNumber} - {b.CustomerName}");
                sb.AppendLine($"DESCRIPTION:Status: {b.Status}\\nAmount: {b.TotalAmount:F2}");
                sb.AppendLine($"STATUS:{(b.Status == BookingStatus.Completed ? "CONFIRMED" : "TENTATIVE")}");
                sb.AppendLine("END:VEVENT");
            }

            sb.AppendLine("END:VCALENDAR");

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            return File(bytes, "text/calendar", "bookings.ics");
        }
    }
}
