using Glanz.API.DTOs;

namespace Glanz.API.Modules.Reports
{
    public interface IReportsService
    {
        Task<DashboardSummaryDto> GetDashboardSummaryAsync(DateTime? startDate, DateTime? endDate);
        Task<FinancialReportDto> GetFinancialReportAsync(DateTime? startDate, DateTime? endDate);
        Task<OperationalReportDto> GetOperationalReportAsync(DateTime? startDate, DateTime? endDate);
        Task<PayrollReportDto> GetPayrollReportAsync(int month, int year);
        Task<(string? Error, string Message)> MarkPayrollPaidAsync(MarkPayrollPaidDto dto);
    }
}
