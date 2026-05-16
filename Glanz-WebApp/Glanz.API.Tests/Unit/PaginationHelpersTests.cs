using Xunit;

namespace Glanz.API.Tests.Unit
{
    // Tests for the pagination arithmetic used in BookingsController.GetAllBookings
    public class PaginationHelpersTests
    {
        // Mirrors the exact clamping done in the controller
        private static (int page, int pageSize, int skip, int take, int totalPages) Paginate(
            int rawPage, int rawPageSize, int totalCount)
        {
            var page      = Math.Max(1, rawPage);
            var pageSize  = Math.Clamp(rawPageSize, 1, 500);
            var skip      = (page - 1) * pageSize;
            var take      = pageSize;
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
            return (page, pageSize, skip, take, totalPages);
        }

        [Fact]
        public void FirstPage_SkipsZero()
        {
            var (_, _, skip, _, _) = Paginate(1, 10, 100);
            Assert.Equal(0, skip);
        }

        [Fact]
        public void SecondPage_SkipsPageSize()
        {
            var (_, _, skip, _, _) = Paginate(2, 10, 100);
            Assert.Equal(10, skip);
        }

        [Fact]
        public void NegativePage_ClampsToOne()
        {
            var (page, _, _, _, _) = Paginate(-5, 10, 50);
            Assert.Equal(1, page);
        }

        [Fact]
        public void ZeroPage_ClampsToOne()
        {
            var (page, _, _, _, _) = Paginate(0, 25, 50);
            Assert.Equal(1, page);
        }

        [Fact]
        public void PageSizeAboveMax_ClampsTo500()
        {
            var (_, pageSize, _, _, _) = Paginate(1, 9999, 100);
            Assert.Equal(500, pageSize);
        }

        [Fact]
        public void PageSizeZero_ClampsToOne()
        {
            var (_, pageSize, _, _, _) = Paginate(1, 0, 100);
            Assert.Equal(1, pageSize);
        }

        [Fact]
        public void TotalPages_RoundsUp()
        {
            var (_, _, _, _, totalPages) = Paginate(1, 10, 25);
            Assert.Equal(3, totalPages);
        }

        [Fact]
        public void TotalPages_ExactMultiple_NoRoundUp()
        {
            var (_, _, _, _, totalPages) = Paginate(1, 10, 30);
            Assert.Equal(3, totalPages);
        }

        [Fact]
        public void EmptyResult_TotalPagesIsZero()
        {
            var (_, _, _, _, totalPages) = Paginate(1, 10, 0);
            Assert.Equal(0, totalPages);
        }
    }
}
