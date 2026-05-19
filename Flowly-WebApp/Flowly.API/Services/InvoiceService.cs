using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Flowly.API.Data;
using Flowly.API.Models;

namespace Flowly.API.Services
{
    public interface IInvoiceService
    {
        Task<byte[]> GeneratePdfAsync(int bookingId, string lang = "en");
        Task<string?> GenerateAndStoreAsync(int bookingId, string lang = "en");
    }

    public class InvoiceService : IInvoiceService
    {
        private readonly AppDbContext _db;
        private readonly IObjectStorageService _storage;
        private readonly ILogger<InvoiceService> _logger;

        public InvoiceService(AppDbContext db, IObjectStorageService storage, ILogger<InvoiceService> logger)
        {
            _db = db;
            _storage = storage;
            _logger = logger;
        }

        public async Task<byte[]> GeneratePdfAsync(int bookingId, string lang = "en")
        {
            var booking = await _db.Bookings
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .Include(b => b.BookingAddOns)
                .FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return Array.Empty<byte>();

            Organization? org = null;
            if (booking.OrgId.HasValue)
                org = await _db.Organizations.AsNoTracking().IgnoreQueryFilters()
                    .FirstOrDefaultAsync(o => o.Id == booking.OrgId.Value);

            QuestPDF.Settings.License = LicenseType.Community;

            var pdf = Document.Create(container =>
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
                                c.Item().Text("INVOICE").Bold().FontSize(16).FontColor(Colors.Blue.Darken2);
                                c.Item().Text($"#{booking.BookingNumber}").FontSize(11);
                                c.Item().Text(booking.ScheduledDate.ToString("dd MMM yyyy")).FontColor(Colors.Grey.Darken1);
                            });
                        });
                        col.Item().PaddingVertical(6).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                    });

                    page.Content().PaddingVertical(10).Column(col =>
                    {
                        // Customer section
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Bill To").Bold().FontSize(11);
                                c.Item().Text(booking.CustomerName);
                                c.Item().Text(booking.CustomerEmail).FontColor(Colors.Grey.Darken2);
                                c.Item().Text(booking.CustomerPhone).FontColor(Colors.Grey.Darken2);
                                if (!string.IsNullOrEmpty(booking.CustomerAddress))
                                    c.Item().Text(booking.CustomerAddress).FontColor(Colors.Grey.Darken2);
                            });
                            row.RelativeItem().AlignRight().Column(c =>
                            {
                                c.Item().Text("Service Date").Bold().FontSize(11);
                                c.Item().Text(booking.ScheduledDate.ToString("dd MMM yyyy"));
                                c.Item().Text(booking.TimeSlot);
                                c.Item().Text(booking.Status.ToString()).FontColor(
                                    booking.Status == BookingStatus.Completed ? Colors.Green.Darken2 : Colors.Grey.Darken1);
                            });
                        });

                        col.Item().PaddingTop(16).Text("Services").Bold().FontSize(11);
                        col.Item().PaddingTop(4).Table(table =>
                        {
                            table.ColumnsDefinition(cols =>
                            {
                                cols.RelativeColumn(4);
                                cols.RelativeColumn(1);
                                cols.RelativeColumn(1);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text("Description").Bold();
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).AlignRight().Text("Qty").Bold();
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).AlignRight().Text("Amount").Bold();
                            });

                            foreach (var item in booking.BookingItems ?? new List<BookingItem>())
                            {
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4)
                                    .Text(item.Package?.Name ?? "Service");
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).AlignRight()
                                    .Text(item.Quantity.ToString());
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).AlignRight()
                                    .Text($"QAR {(item.Price * item.Quantity):0.00}");
                            }

                            foreach (var addOn in booking.BookingAddOns ?? new List<BookingAddOn>())
                            {
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4)
                                    .Text(addOn.Name + " (add-on)").Italic();
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).AlignRight()
                                    .Text("1");
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).AlignRight()
                                    .Text($"QAR {addOn.Price:0.00}");
                            }
                        });

                        // Totals
                        col.Item().PaddingTop(8).AlignRight().Column(c =>
                        {
                            if (booking.DiscountAmount > 0)
                            {
                                c.Item().Row(r =>
                                {
                                    r.RelativeItem().AlignRight().Text("Discount:").FontColor(Colors.Grey.Darken1);
                                    r.ConstantItem(90).AlignRight().Text($"-QAR {booking.DiscountAmount:0.00}").FontColor(Colors.Green.Darken2);
                                });
                            }
                            c.Item().Row(r =>
                            {
                                r.RelativeItem().AlignRight().Text("Total:").Bold().FontSize(12);
                                r.ConstantItem(90).AlignRight().Text($"QAR {booking.TotalAmount:0.00}").Bold().FontSize(12);
                            });
                            if (booking.TipAmount.HasValue && booking.TipAmount > 0)
                            {
                                c.Item().Row(r =>
                                {
                                    r.RelativeItem().AlignRight().Text("Tip:").FontColor(Colors.Grey.Darken1);
                                    r.ConstantItem(90).AlignRight().Text($"QAR {booking.TipAmount:0.00}").FontColor(Colors.Orange.Darken2);
                                });
                            }
                        });

                        if (!string.IsNullOrEmpty(booking.SpecialInstructions))
                        {
                            col.Item().PaddingTop(12).Column(c =>
                            {
                                c.Item().Text("Notes").Bold();
                                c.Item().Text(booking.SpecialInstructions).FontColor(Colors.Grey.Darken2);
                            });
                        }
                    });

                    page.Footer().AlignCenter().Text(text =>
                    {
                        text.Span("Thank you for your business! ").FontColor(Colors.Grey.Darken1);
                        text.Span(org?.Name ?? "Flowly").Bold();
                    });
                });
            });

            return pdf.GeneratePdf();
        }

        public async Task<string?> GenerateAndStoreAsync(int bookingId, string lang = "en")
        {
            try
            {
                var pdfBytes = await GeneratePdfAsync(bookingId, lang);
                if (pdfBytes.Length == 0) return null;

                var result = await _storage.UploadBytesAsync(pdfBytes, "invoices", $"booking-{bookingId}-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf", "application/pdf");
                var url = result.PublicUrl;

                // Store URL on booking
                var booking = await _db.Bookings.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == bookingId);
                if (booking != null)
                {
                    booking.InvoicePdfUrl = url;
                    booking.UpdatedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();
                }
                return url;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Invoice] Failed to generate PDF for booking {BookingId}", bookingId);
                return null;
            }
        }
    }
}
