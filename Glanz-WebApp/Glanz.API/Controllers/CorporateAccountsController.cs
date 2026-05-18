using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.Platform.Tenancy;
using Glanz.API.Services;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class CorporateAccountsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly TenantContext _tenantContext;

        public CorporateAccountsController(AppDbContext db, TenantContext tenantContext)
        {
            _db = db;
            _tenantContext = tenantContext;
        }

        // ── CRUD ──────────────────────────────────────────────────────────────

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var accounts = await _db.CorporateAccounts
                .AsNoTracking()
                .Include(a => a.Members)
                .OrderBy(a => a.CompanyName)
                .Select(a => new
                {
                    a.Id,
                    a.CompanyName,
                    a.BillingEmail,
                    a.BillingPhone,
                    a.Notes,
                    a.CreditLimit,
                    a.UsedCredit,
                    a.DiscountPercent,
                    a.IsActive,
                    a.CreatedAt,
                    MemberCount = a.Members.Count
                })
                .ToListAsync();
            return Ok(accounts);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var account = await _db.CorporateAccounts
                .AsNoTracking()
                .Include(a => a.Members).ThenInclude(m => m.User)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (account == null) return NotFound(new { message = "Account not found" });

            return Ok(new
            {
                account.Id,
                account.CompanyName,
                account.BillingEmail,
                account.BillingPhone,
                account.Notes,
                account.CreditLimit,
                account.UsedCredit,
                account.DiscountPercent,
                account.IsActive,
                account.CreatedAt,
                Members = account.Members.Select(m => new
                {
                    m.Id,
                    m.UserId,
                    m.AddedAt,
                    UserName = m.User != null ? m.User.FirstName + " " + m.User.LastName : null,
                    UserEmail = m.User?.Email,
                    UserPhone = m.User?.Phone
                })
            });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CorporateAccountDto dto)
        {
            var account = new CorporateAccount
            {
                OrgId = _tenantContext.OrgId,
                CompanyName = dto.CompanyName.Trim(),
                BillingEmail = dto.BillingEmail?.Trim(),
                BillingPhone = dto.BillingPhone?.Trim(),
                Notes = dto.Notes?.Trim(),
                CreditLimit = dto.CreditLimit,
                DiscountPercent = dto.DiscountPercent,
                IsActive = dto.IsActive
            };
            _db.CorporateAccounts.Add(account);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = account.Id }, new { account.Id });
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] CorporateAccountDto dto)
        {
            var account = await _db.CorporateAccounts.FirstOrDefaultAsync(a => a.Id == id);
            if (account == null) return NotFound(new { message = "Account not found" });

            account.CompanyName = dto.CompanyName.Trim();
            account.BillingEmail = dto.BillingEmail?.Trim();
            account.BillingPhone = dto.BillingPhone?.Trim();
            account.Notes = dto.Notes?.Trim();
            account.CreditLimit = dto.CreditLimit;
            account.DiscountPercent = dto.DiscountPercent;
            account.IsActive = dto.IsActive;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var account = await _db.CorporateAccounts.FirstOrDefaultAsync(a => a.Id == id);
            if (account == null) return NotFound(new { message = "Account not found" });
            account.IsActive = false;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── Members ───────────────────────────────────────────────────────────

        [HttpPost("{id:int}/members")]
        public async Task<IActionResult> AddMember(int id, [FromBody] AddMemberDto dto)
        {
            var account = await _db.CorporateAccounts.FirstOrDefaultAsync(a => a.Id == id);
            if (account == null) return NotFound(new { message = "Account not found" });

            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == dto.UserId);
            if (user == null) return BadRequest(new { message = "User not found" });

            var exists = await _db.CorporateAccountMembers
                .AnyAsync(m => m.CorporateAccountId == id && m.UserId == dto.UserId);
            if (exists) return Conflict(new { message = "User is already a member" });

            _db.CorporateAccountMembers.Add(new CorporateAccountMember
            {
                OrgId = _tenantContext.OrgId,
                CorporateAccountId = id,
                UserId = dto.UserId
            });
            await _db.SaveChangesAsync();
            return Ok(new { userName = user.FirstName + " " + user.LastName });
        }

        [HttpDelete("{id:int}/members/{memberId:int}")]
        public async Task<IActionResult> RemoveMember(int id, int memberId)
        {
            var member = await _db.CorporateAccountMembers
                .FirstOrDefaultAsync(m => m.Id == memberId && m.CorporateAccountId == id);
            if (member == null) return NotFound(new { message = "Member not found" });
            _db.CorporateAccountMembers.Remove(member);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── Bookings (consolidated view) ──────────────────────────────────────

        [HttpGet("{id:int}/bookings")]
        public async Task<IActionResult> GetBookings(int id, [FromQuery] int year = 0, [FromQuery] int month = 0)
        {
            var account = await _db.CorporateAccounts.AsNoTracking()
                .Include(a => a.Members)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (account == null) return NotFound(new { message = "Account not found" });

            var memberUserIds = account.Members.Select(m => m.UserId).ToList();

            var query = _db.Bookings.AsNoTracking().IgnoreQueryFilters()
                .Where(b => b.OrgId == _tenantContext.OrgId && memberUserIds.Contains(b.UserId ?? 0));

            if (year > 0 && month > 0)
                query = query.Where(b => b.ScheduledDate.Year == year && b.ScheduledDate.Month == month);
            else if (year > 0)
                query = query.Where(b => b.ScheduledDate.Year == year);

            var bookings = await query
                .OrderByDescending(b => b.ScheduledDate)
                .Select(b => new
                {
                    b.Id,
                    b.BookingNumber,
                    b.CustomerName,
                    b.ScheduledDate,
                    b.TimeSlot,
                    Status = b.Status.ToString(),
                    b.TotalAmount,
                    b.DiscountAmount,
                    b.UserId
                })
                .ToListAsync();

            var total = bookings.Sum(b => b.TotalAmount);
            return Ok(new { bookings, total, count = bookings.Count });
        }

        // ── Consolidated Invoice PDF ───────────────────────────────────────────

        [HttpGet("{id:int}/invoice")]
        public async Task<IActionResult> GetInvoicePdf(int id, [FromQuery] int year = 0, [FromQuery] int month = 0)
        {
            var account = await _db.CorporateAccounts.AsNoTracking()
                .Include(a => a.Members)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (account == null) return NotFound(new { message = "Account not found" });

            var org = await _db.Organizations.AsNoTracking().IgnoreQueryFilters()
                .FirstOrDefaultAsync(o => o.Id == _tenantContext.OrgId);

            var memberUserIds = account.Members.Select(m => m.UserId).ToList();

            var query = _db.Bookings.AsNoTracking().IgnoreQueryFilters()
                .Where(b => b.OrgId == _tenantContext.OrgId && memberUserIds.Contains(b.UserId ?? 0)
                    && (b.Status == BookingStatus.Completed || b.Status == BookingStatus.Confirmed));

            if (year > 0 && month > 0)
                query = query.Where(b => b.ScheduledDate.Year == year && b.ScheduledDate.Month == month);

            var bookings = await query.OrderBy(b => b.ScheduledDate).ToListAsync();

            QuestPDF.Settings.License = LicenseType.Community;

            var periodLabel = year > 0 && month > 0
                ? new DateTime(year, month, 1).ToString("MMMM yyyy")
                : year > 0 ? year.ToString() : "All Time";

            var pdfBytes = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(40);
                    page.DefaultTextStyle(t => t.FontSize(10).FontFamily("Arial"));

                    page.Header().Column(col =>
                    {
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text(org?.Name ?? "Flowly").Bold().FontSize(20);
                                if (!string.IsNullOrEmpty(org?.BillingEmail))
                                    c.Item().Text(org.BillingEmail).FontColor(Colors.Grey.Darken2);
                            });
                            row.RelativeItem().AlignRight().Column(c =>
                            {
                                c.Item().Text("CONSOLIDATED INVOICE").Bold().FontSize(14).FontColor(Colors.Blue.Darken2);
                                c.Item().Text(account.CompanyName).Bold().FontSize(11);
                                c.Item().Text(periodLabel).FontColor(Colors.Grey.Darken1);
                            });
                        });
                        col.Item().PaddingVertical(6).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                    });

                    page.Content().PaddingVertical(10).Column(col =>
                    {
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Bill To").Bold().FontSize(11);
                                c.Item().Text(account.CompanyName);
                                if (!string.IsNullOrEmpty(account.BillingEmail))
                                    c.Item().Text(account.BillingEmail).FontColor(Colors.Grey.Darken2);
                                if (!string.IsNullOrEmpty(account.BillingPhone))
                                    c.Item().Text(account.BillingPhone).FontColor(Colors.Grey.Darken2);
                            });
                            row.RelativeItem().AlignRight().Column(c =>
                            {
                                c.Item().Text("Period").Bold().FontSize(11);
                                c.Item().Text(periodLabel);
                                if (account.DiscountPercent > 0)
                                    c.Item().Text($"Corporate Discount: {account.DiscountPercent:0.##}%").FontColor(Colors.Green.Darken2);
                            });
                        });

                        col.Item().PaddingTop(16).Text("Bookings").Bold().FontSize(11);
                        col.Item().PaddingTop(4).Table(table =>
                        {
                            table.ColumnsDefinition(cols =>
                            {
                                cols.RelativeColumn(2);
                                cols.RelativeColumn(3);
                                cols.RelativeColumn(2);
                                cols.RelativeColumn(2);
                                cols.RelativeColumn(2);
                            });

                            table.Header(header =>
                            {
                                foreach (var h in new[] { "Booking #", "Customer", "Date", "Time", "Amount" })
                                    header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text(h).Bold();
                            });

                            foreach (var b in bookings)
                            {
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text(b.BookingNumber);
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text(b.CustomerName);
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text(b.ScheduledDate.ToString("dd MMM yyyy"));
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text(b.TimeSlot);
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).AlignRight().Text($"QAR {b.TotalAmount:0.00}");
                            }
                        });

                        var subtotal = bookings.Sum(b => b.TotalAmount);
                        var discount = account.DiscountPercent > 0
                            ? Math.Round(subtotal * account.DiscountPercent / 100, 2)
                            : 0m;
                        var grandTotal = subtotal - discount;

                        col.Item().PaddingTop(8).AlignRight().Column(c =>
                        {
                            c.Item().Row(r =>
                            {
                                r.RelativeItem().AlignRight().Text("Subtotal:").FontColor(Colors.Grey.Darken1);
                                r.ConstantItem(100).AlignRight().Text($"QAR {subtotal:0.00}");
                            });
                            if (discount > 0)
                            {
                                c.Item().Row(r =>
                                {
                                    r.RelativeItem().AlignRight().Text($"Discount ({account.DiscountPercent:0.##}%):").FontColor(Colors.Green.Darken2);
                                    r.ConstantItem(100).AlignRight().Text($"-QAR {discount:0.00}").FontColor(Colors.Green.Darken2);
                                });
                            }
                            c.Item().Row(r =>
                            {
                                r.RelativeItem().AlignRight().Text("Total Due:").Bold().FontSize(12);
                                r.ConstantItem(100).AlignRight().Text($"QAR {grandTotal:0.00}").Bold().FontSize(12);
                            });
                        });
                    });

                    page.Footer().AlignCenter().Text(text =>
                    {
                        text.Span("Thank you! ").FontColor(Colors.Grey.Darken1);
                        text.Span(org?.Name ?? "Flowly").Bold();
                    });
                });
            }).GeneratePdf();

            var fileName = $"invoice-{account.CompanyName.Replace(" ", "-").ToLower()}-{periodLabel.Replace(" ", "-")}.pdf";
            return File(pdfBytes, "application/pdf", fileName);
        }
    }

    public class CorporateAccountDto
    {
        public string CompanyName { get; set; } = string.Empty;
        public string? BillingEmail { get; set; }
        public string? BillingPhone { get; set; }
        public string? Notes { get; set; }
        public decimal CreditLimit { get; set; }
        public decimal DiscountPercent { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class AddMemberDto
    {
        public int UserId { get; set; }
    }
}
