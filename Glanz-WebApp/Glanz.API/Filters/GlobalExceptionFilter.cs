using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Text.Json;

namespace Glanz.API.Filters;

public class GlobalExceptionFilter : IExceptionFilter
{
    private readonly ILogger<GlobalExceptionFilter> _logger;
    private readonly IHostEnvironment _env;

    public GlobalExceptionFilter(ILogger<GlobalExceptionFilter> logger, IHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    public void OnException(ExceptionContext context)
    {
        var correlationId = context.HttpContext.TraceIdentifier;
        var path = context.HttpContext.Request.Path.Value;
        var method = context.HttpContext.Request.Method;

        _logger.LogError(
            context.Exception,
            "[{CorrelationId}] Unhandled exception on {Method} {Path}",
            correlationId, method, path);

        var response = new ApiErrorResponse
        {
            CorrelationId = correlationId,
            Message = GetSafeErrorMessage(context.Exception),
            Details = _env.IsDevelopment() ? context.Exception.ToString() : null
        };

        var statusCode = DetermineStatusCode(context.Exception);

        context.Result = new ObjectResult(response)
        {
            StatusCode = statusCode,
            ContentTypes = { "application/json" }
        };

        context.ExceptionHandled = true;
    }

    private static string GetSafeErrorMessage(Exception ex)
    {
        return ex switch
        {
            ArgumentException => ex.Message,
            UnauthorizedAccessException => "Unauthorized access.",
            KeyNotFoundException => "Resource not found.",
            InvalidOperationException => ex.Message,
            DbUpdateException => "A database operation failed. Please try again.",
            _ => "An unexpected error occurred. Please try again later."
        };
    }

    private static int DetermineStatusCode(Exception ex)
    {
        return ex switch
        {
            ArgumentException => (int)HttpStatusCode.BadRequest,
            UnauthorizedAccessException => (int)HttpStatusCode.Unauthorized,
            KeyNotFoundException => (int)HttpStatusCode.NotFound,
            InvalidOperationException => (int)HttpStatusCode.BadRequest,
            NotImplementedException => (int)HttpStatusCode.NotImplemented,
            DbUpdateException => (int)HttpStatusCode.Conflict,
            _ => (int)HttpStatusCode.InternalServerError
        };
    }
}

public class ApiErrorResponse
{
    public string CorrelationId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTime Timestamp => DateTime.UtcNow;
}