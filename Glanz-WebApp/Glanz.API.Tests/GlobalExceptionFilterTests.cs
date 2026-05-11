using Glanz.API.Filters;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Glanz.API.Tests;

public class GlobalExceptionFilterTests
{
    [Fact]
    public void OnException_ReturnsBadRequestForValidationStyleErrors()
    {
        var filter = new GlobalExceptionFilter(NullLogger<GlobalExceptionFilter>.Instance, new TestHostEnvironment(false));
        var context = CreateContext(new InvalidOperationException("Invalid config"));

        filter.OnException(context);

        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, result.StatusCode);
        var payload = Assert.IsType<ApiErrorResponse>(result.Value);
        Assert.Equal("Invalid config", payload.Message);
        Assert.Null(payload.Details);
    }

    [Fact]
    public void OnException_UsesConflictForDatabaseErrors()
    {
        var filter = new GlobalExceptionFilter(NullLogger<GlobalExceptionFilter>.Instance, new TestHostEnvironment(false));
        var context = CreateContext(new Microsoft.EntityFrameworkCore.DbUpdateException("db failed", new Exception("inner")));

        filter.OnException(context);

        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(StatusCodes.Status409Conflict, result.StatusCode);
        var payload = Assert.IsType<ApiErrorResponse>(result.Value);
        Assert.Equal("A database operation failed. Please try again.", payload.Message);
    }

    [Fact]
    public void OnException_ExposesDetailsOnlyInDevelopment()
    {
        var filter = new GlobalExceptionFilter(NullLogger<GlobalExceptionFilter>.Instance, new TestHostEnvironment(true));
        var context = CreateContext(new Exception("stripe exploded"));

        filter.OnException(context);

        var result = Assert.IsType<ObjectResult>(context.Result);
        var payload = Assert.IsType<ApiErrorResponse>(result.Value);
        Assert.Contains("stripe exploded", payload.Details ?? string.Empty);
    }

    private static ExceptionContext CreateContext(Exception exception)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.TraceIdentifier = "trace-123";

        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
        var filters = new List<IFilterMetadata>();
        return new ExceptionContext(actionContext, filters)
        {
            Exception = exception
        };
    }

    private sealed class TestHostEnvironment : Microsoft.Extensions.Hosting.IHostEnvironment
    {
        public TestHostEnvironment(bool isDevelopment)
        {
            EnvironmentName = isDevelopment ? Microsoft.Extensions.Hosting.Environments.Development : Microsoft.Extensions.Hosting.Environments.Production;
            ApplicationName = "Glanz.API.Tests";
            ContentRootPath = AppContext.BaseDirectory;
        }

        public string EnvironmentName { get; set; }
        public string ApplicationName { get; set; }
        public string ContentRootPath { get; set; }
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = default!;
    }
}
