using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;

namespace Flowly.API.Services
{
    public static class ObjectStorageProviders
    {
        public const string Local = "Local";
        public const string S3 = "S3";
    }

    public sealed class ObjectStorageOptions
    {
        public const string SectionName = "ObjectStorage";

        public string Provider { get; set; } = ObjectStorageProviders.Local;
        public string BucketName { get; set; } = string.Empty;
        public string Region { get; set; } = "auto";
        public string ServiceUrl { get; set; } = string.Empty;
        public string PublicBaseUrl { get; set; } = string.Empty;
        public string AccessKey { get; set; } = string.Empty;
        public string SecretKey { get; set; } = string.Empty;
        public string KeyPrefix { get; set; } = "uploads";
        public bool UsePathStyle { get; set; } = true;
    }

    public sealed record StoredObjectResult(string StorageKey, string PublicUrl);

    public interface IObjectStorageService
    {
        Task<StoredObjectResult> UploadAsync(IFormFile file, string category, string fileName, CancellationToken cancellationToken = default);
        Task<StoredObjectResult> UploadBytesAsync(byte[] data, string category, string fileName, string contentType, CancellationToken cancellationToken = default);
        Task DeleteAsync(string? publicUrlOrPath, CancellationToken cancellationToken = default);
    }

    public sealed class ObjectStorageService : IObjectStorageService
    {
        private readonly ObjectStorageOptions _options;
        private readonly IWebHostEnvironment _environment;
        private readonly IAmazonS3 _s3Client;

        public ObjectStorageService(IOptions<ObjectStorageOptions> options, IWebHostEnvironment environment, IAmazonS3 s3Client)
        {
            _options = options.Value;
            _environment = environment;
            _s3Client = s3Client;
        }

        public async Task<StoredObjectResult> UploadAsync(IFormFile file, string category, string fileName, CancellationToken cancellationToken = default)
        {
            var storageKey = BuildStorageKey(category, fileName);

            if (UseLocalProvider())
            {
                var relativePath = storageKey.Replace('/', Path.DirectorySeparatorChar);
                var absolutePath = Path.Combine(_environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"), relativePath);
                var folder = Path.GetDirectoryName(absolutePath);
                if (!string.IsNullOrWhiteSpace(folder))
                {
                    Directory.CreateDirectory(folder);
                }

                await using var fileStream = new FileStream(absolutePath, FileMode.Create, FileAccess.Write, FileShare.None);
                await file.CopyToAsync(fileStream, cancellationToken);
                return new StoredObjectResult(storageKey, ToLocalPublicUrl(storageKey));
            }

            EnsureS3Configured();

            await using var stream = file.OpenReadStream();
            var request = new PutObjectRequest
            {
                BucketName = _options.BucketName,
                Key = storageKey,
                InputStream = stream,
                ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            };

            await _s3Client.PutObjectAsync(request, cancellationToken);
            return new StoredObjectResult(storageKey, ToRemotePublicUrl(storageKey));
        }

        public async Task<StoredObjectResult> UploadBytesAsync(byte[] data, string category, string fileName, string contentType, CancellationToken cancellationToken = default)
        {
            var storageKey = BuildStorageKey(category, fileName);

            if (UseLocalProvider())
            {
                var relativePath = storageKey.Replace('/', Path.DirectorySeparatorChar);
                var absolutePath = Path.Combine(_environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"), relativePath);
                Directory.CreateDirectory(Path.GetDirectoryName(absolutePath)!);
                await File.WriteAllBytesAsync(absolutePath, data, cancellationToken);
                return new StoredObjectResult(storageKey, ToLocalPublicUrl(storageKey));
            }

            EnsureS3Configured();
            using var stream = new MemoryStream(data);
            await _s3Client.PutObjectAsync(new PutObjectRequest
            {
                BucketName = _options.BucketName,
                Key = storageKey,
                InputStream = stream,
                ContentType = contentType
            }, cancellationToken);
            return new StoredObjectResult(storageKey, ToRemotePublicUrl(storageKey));
        }

        public async Task DeleteAsync(string? publicUrlOrPath, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(publicUrlOrPath))
            {
                return;
            }

            if (TryMapToLocalRelativePath(publicUrlOrPath, out var localRelativePath))
            {
                var absolutePath = Path.Combine(_environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"), localRelativePath.Replace('/', Path.DirectorySeparatorChar));
                if (File.Exists(absolutePath))
                {
                    File.Delete(absolutePath);
                }
                return;
            }

            if (UseLocalProvider())
            {
                return;
            }

            var storageKey = TryExtractRemoteStorageKey(publicUrlOrPath);
            if (string.IsNullOrWhiteSpace(storageKey))
            {
                return;
            }

            EnsureS3Configured();
            await _s3Client.DeleteObjectAsync(_options.BucketName, storageKey, cancellationToken);
        }

        private bool UseLocalProvider() =>
            string.IsNullOrWhiteSpace(_options.Provider) || string.Equals(_options.Provider, ObjectStorageProviders.Local, StringComparison.OrdinalIgnoreCase);

        private string BuildStorageKey(string category, string fileName)
        {
            var cleanCategory = category.Trim().Trim('/');
            var cleanFileName = fileName.Trim().Trim('/');
            var prefix = (_options.KeyPrefix ?? "uploads").Trim().Trim('/');
            return string.IsNullOrWhiteSpace(prefix)
                ? $"{cleanCategory}/{cleanFileName}"
                : $"{prefix}/{cleanCategory}/{cleanFileName}";
        }

        private string ToLocalPublicUrl(string storageKey) => "/" + storageKey.Replace("\\", "/");

        private string ToRemotePublicUrl(string storageKey)
        {
            var baseUrl = (_options.PublicBaseUrl ?? string.Empty).Trim().TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(baseUrl))
            {
                return $"{baseUrl}/{storageKey}";
            }

            var serviceUrl = (_options.ServiceUrl ?? string.Empty).Trim().TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(serviceUrl))
            {
                if (_options.UsePathStyle)
                {
                    return $"{serviceUrl}/{_options.BucketName}/{storageKey}";
                }

                var uri = new Uri(serviceUrl);
                return $"{uri.Scheme}://{_options.BucketName}.{uri.Host}/{storageKey}";
            }

            return storageKey;
        }

        private bool TryMapToLocalRelativePath(string publicUrlOrPath, out string relativePath)
        {
            relativePath = string.Empty;
            if (string.IsNullOrWhiteSpace(publicUrlOrPath))
            {
                return false;
            }

            if (publicUrlOrPath.StartsWith("/", StringComparison.Ordinal))
            {
                relativePath = publicUrlOrPath.TrimStart('/');
                return true;
            }

            if (Uri.TryCreate(publicUrlOrPath, UriKind.Absolute, out var absoluteUri))
            {
                var publicBaseUrl = (_options.PublicBaseUrl ?? string.Empty).Trim().TrimEnd('/');
                if (!string.IsNullOrWhiteSpace(publicBaseUrl) && publicUrlOrPath.StartsWith(publicBaseUrl + "/", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                relativePath = absoluteUri.AbsolutePath.TrimStart('/');
                return absoluteUri.IsLoopback;
            }

            return false;
        }

        private string? TryExtractRemoteStorageKey(string publicUrlOrPath)
        {
            if (string.IsNullOrWhiteSpace(publicUrlOrPath))
            {
                return null;
            }

            var publicBaseUrl = (_options.PublicBaseUrl ?? string.Empty).Trim().TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(publicBaseUrl) && publicUrlOrPath.StartsWith(publicBaseUrl + "/", StringComparison.OrdinalIgnoreCase))
            {
                return publicUrlOrPath[(publicBaseUrl.Length + 1)..];
            }

            if (!Uri.TryCreate(publicUrlOrPath, UriKind.Absolute, out var uri))
            {
                return null;
            }

            var path = uri.AbsolutePath.Trim('/');
            if (_options.UsePathStyle && path.StartsWith(_options.BucketName + "/", StringComparison.OrdinalIgnoreCase))
            {
                return path[(
                    _options.BucketName.Length + 1)..];
            }

            return path;
        }

        private void EnsureS3Configured()
        {
            if (string.IsNullOrWhiteSpace(_options.BucketName))
            {
                throw new InvalidOperationException("ObjectStorage:BucketName must be configured when using S3 storage.");
            }
        }
    }
}