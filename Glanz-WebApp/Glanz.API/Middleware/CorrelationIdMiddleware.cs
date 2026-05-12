namespace Glanz.API.Middleware
{
    /// <summary>
    /// Propagates a request-scoped correlation ID for end-to-end tracing.
    ///
    /// - Reads X-Correlation-Id from the incoming request (set by the client or a gateway).
    /// - Generates a short random ID if the header is absent.
    /// - Stores the ID in HttpContext.Items["CorrelationId"] for use in log scopes and error responses.
    /// - Echoes the ID back on the response so the frontend can correlate client-side errors
    ///   with backend log entries (e.g. when reporting a support ticket).
    ///
    /// TODO: If you add Serilog, replace the ILogger scope with:
    ///   using (Serilog.Context.LogContext.PushProperty("CorrelationId", correlationId)) { ... }
    ///   This makes the ID appear in every structured log line for the request automatically.
    /// </summary>
    public class CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
    {
        public const string HeaderName     = "X-Correlation-Id";
        public const string HttpContextKey = "CorrelationId";

        public async Task InvokeAsync(HttpContext context)
        {
            var correlationId = context.Request.Headers[HeaderName].FirstOrDefault();

            if (string.IsNullOrWhiteSpace(correlationId))
                correlationId = Guid.NewGuid().ToString("N")[..16]; // short 16-char hex

            context.Items[HttpContextKey]        = correlationId;
            context.Response.Headers[HeaderName] = correlationId;

            using (logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId }))
            {
                await next(context);
            }
        }
    }
}
