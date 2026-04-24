using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Net;
using System.Text.Json;

namespace Glanz.API.Filters;

public class ValidationErrorResponse
{
    public string CorrelationId { get; set; } = string.Empty;
    public string Message { get; set; } = "Validation failed";
    public List<ValidationError> Errors { get; set; } = new();
    public DateTime Timestamp => DateTime.UtcNow;
}

public class ValidationError
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class FluentValidationFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.ModelState.IsValid)
        {
            var errors = context.ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .SelectMany(x => x.Value!.Errors.Select(e => new ValidationError
                {
                    Field = x.Key,
                    Message = e.ErrorMessage
                }))
                .ToList();

            var response = new ValidationErrorResponse
            {
                CorrelationId = context.HttpContext.TraceIdentifier,
                Errors = errors
            };

            context.Result = new BadRequestObjectResult(response)
            {
                ContentTypes = { "application/json" }
            };
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}