namespace Glanz.API.DTOs
{
    public class FinancialReportDto
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal TotalCost { get; set; }
        public decimal TotalProfit { get; set; }
        public decimal ProfitMarginPercent { get; set; }
        public int TotalBookings { get; set; }
        public decimal AverageBookingValue { get; set; }
        public List<DailyFinancialDto> DailyBreakdown { get; set; } = new();
        public List<ServiceMarginDto> ServiceMargins { get; set; } = new();
        public List<OutstandingPaymentDto> OutstandingPayments { get; set; } = new();
        public decimal OutstandingTotal { get; set; }
    }

    public class DailyFinancialDto
    {
        public DateTime Date { get; set; }
        public decimal Revenue { get; set; }
        public decimal Cost { get; set; }
        public decimal Profit { get; set; }
        public int BookingCount { get; set; }
    }

    public class OperationalReportDto
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int TotalBookings { get; set; }
        public int CompletedBookings { get; set; }
        public int CancelledBookings { get; set; }
        public int PendingBookings { get; set; }
        public List<PackagePopularityDto> PackagePopularity { get; set; } = new();
        public List<ProductUsageDto> TopProductsUsed { get; set; } = new();
        public Dictionary<string, int> BookingsByStatus { get; set; } = new();
    }

    public class PackagePopularityDto
    {
        public string PackageName { get; set; } = string.Empty;
        public string Tier { get; set; } = string.Empty;
        public int BookingCount { get; set; }
        public decimal TotalRevenue { get; set; }
    }

    public class ProductUsageDto
    {
        public string ProductName { get; set; } = string.Empty;
        public decimal TotalQuantityUsed { get; set; }
        public string Unit { get; set; } = string.Empty;
        public decimal TotalCost { get; set; }
    }

    public class ServiceMarginDto
    {
        public string ServiceName { get; set; } = string.Empty;
        public string? PackageName { get; set; }
        public int JobCount { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal TotalCost { get; set; }
        public decimal TotalProfit { get; set; }
        public decimal MarginPercent { get; set; }
    }

    public class OutstandingPaymentDto
    {
        public int BookingId { get; set; }
        public string BookingNumber { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
        public string BookingStatus { get; set; } = string.Empty;
        public DateTime ScheduledDate { get; set; }
    }

    public class DashboardSummaryDto
    {
        public DateTime WindowStart { get; set; }
        public DateTime WindowEnd { get; set; }
        public int TotalBookings { get; set; }
        public int PendingBookings { get; set; }
        public int CompletedBookings { get; set; }
        public int ActiveCustomers { get; set; }
        public int ActivePackages { get; set; }
        public int ActiveServices { get; set; }
        public int ActiveProducts { get; set; }
        public int RecentBookings { get; set; }
        public decimal RecentRevenue { get; set; }
        public decimal LifetimeRevenue { get; set; }
    }

    public class PayrollReportDto
    {
        public int Month { get; set; }
        public int Year { get; set; }
        public List<PayrollEmployeeDto> Employees { get; set; } = new();
    }

    public class PayrollEmployeeDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public decimal MonthlySalary { get; set; }
        public double HoursWorked { get; set; }
        public decimal HourlyRate { get; set; }
        public decimal GrossPay { get; set; }
        public decimal Deductions { get; set; }
        public decimal NetPay { get; set; }
        public int JobsCompleted { get; set; }
        public decimal RevenueGenerated { get; set; }
        public decimal TotalTips { get; set; }
        public bool IsPaid { get; set; }
        public DateTime? PaidAt { get; set; }
        public List<PayrollJobDetail> JobDetails { get; set; } = new();
    }

    public class PayrollJobDetail
    {
        public int BookingId { get; set; }
        public string BookingNumber { get; set; } = string.Empty;
        public DateTime CompletedAt { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string PackageName { get; set; } = string.Empty;
        public string VehicleType { get; set; } = string.Empty;
        public double DurationHours { get; set; }
        public decimal Amount { get; set; }
        public decimal TipAmount { get; set; }
    }

    public class MarkPayrollPaidDto
    {
        public int EmployeeId { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
    }
}