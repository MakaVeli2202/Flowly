using Glanz.API.Models;
using Glanz.API.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Glanz.API.Data;

public static class DevelopmentDataSeeder
{
    public static async Task SeedAsync(IServiceProvider sp, IConfiguration configuration, IHostEnvironment environment)
    {
        if (!environment.IsDevelopment())
            return;

        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var resetDatabase = configuration.GetValue("SeedData:ResetDatabaseOnStartup", false);
        var seedDemoData = configuration.GetValue("SeedData:SeedDemoData", true);

        if (resetDatabase)
            await db.Database.EnsureDeletedAsync();

        await db.Database.MigrateAsync();

        if (!seedDemoData)
            return;

        var hasData = await db.Services.AnyAsync()
                   || await db.Packages.AnyAsync();

        if (hasData)
            return;

        var now = DateTime.UtcNow;

        // â”€â”€ Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        var adminEmail    = configuration["AdminUser:Email"]     ?? "admin@glanz.qa";
        var adminPassword = configuration["AdminUser:Password"]  ?? "Admin123!";
        var admin = new User
        {
            FirstName    = configuration["AdminUser:FirstName"] ?? "Admin",
            LastName     = configuration["AdminUser:LastName"]  ?? "User",
            Email        = adminEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
            Phone        = configuration["AdminUser:Phone"] ?? "+97444444444",
            Role         = "Admin",
            IsActive     = true,
            CreatedAt    = now,
            UpdatedAt    = now,
        };
        await db.Users.AddAsync(admin);

        // â”€â”€ Workers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        var workers = new List<Staff>
        {
            new()
            {
                FirstName      = "Ahmed",
                LastName       = "Al-Mansoori",
                Email          = "ahmed.mansoori@glanz.qa",
                PasswordHash   = BCrypt.Net.BCrypt.HashPassword("Worker123!"),
                Phone          = "+97450000001",
                Role           = "Employee",
                IsActive       = true,
                WorkingDays    = "Sunday,Monday,Tuesday,Wednesday,Thursday",
                ShiftStart     = "08:00",
                ShiftEnd       = "17:00",
                MonthlySalary  = 4500.00m,
                CreatedAt      = now,
                UpdatedAt      = now,
            },
            new()
            {
                FirstName      = "Sara",
                LastName       = "Al-Farsi",
                Email          = "sara.alfarsi@glanz.qa",
                PasswordHash   = BCrypt.Net.BCrypt.HashPassword("Worker123!"),
                Phone          = "+97450000002",
                Role           = "Employee",
                IsActive       = true,
                WorkingDays    = "Sunday,Monday,Tuesday,Wednesday,Thursday",
                ShiftStart     = "10:00",
                ShiftEnd       = "19:00",
                MonthlySalary  = 3800.00m,
                CreatedAt      = now,
                UpdatedAt      = now,
            },
        };

        // â”€â”€ Customers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        var customers = new List<User>
        {
            new()
            {
                FirstName              = "Khalid",
                LastName               = "Al-Thani",
                Email                  = "khalid.althani@gmail.com",
                PasswordHash           = BCrypt.Net.BCrypt.HashPassword("Customer123!"),
                Phone                  = "+97450001111",
                HomeAddress            = "West Bay Lagoon, Doha",
                WorkAddress            = "Diplomatic Street, Doha",
                PreferredAddressType   = "Home",
                Role                   = "Customer",
                IsActive               = true,
                CreatedAt              = now,
                UpdatedAt              = now,
            },
            new()
            {
                FirstName              = "Fatima",
                LastName               = "Al-Rashidi",
                Email                  = "fatima.rashidi@gmail.com",
                PasswordHash           = BCrypt.Net.BCrypt.HashPassword("Customer123!"),
                Phone                  = "+97450002222",
                HomeAddress            = "The Pearl, Doha",
                WorkAddress            = "Lusail Marina Promenade, Lusail",
                PreferredAddressType   = "Work",
                Role                   = "Customer",
                IsActive               = true,
                CreatedAt              = now,
                UpdatedAt              = now,
            },
            new()
            {
                FirstName              = "Omar",
                LastName               = "Hassan",
                Email                  = "omar.hassan@gmail.com",
                PasswordHash           = BCrypt.Net.BCrypt.HashPassword("Customer123!"),
                Phone                  = "+97450003333",
                HomeAddress            = "Al Waab Street, Doha",
                PreferredAddressType   = "Home",
                Role                   = "Customer",
                IsActive               = true,
                CreatedAt              = now,
                UpdatedAt              = now,
            },
            new()
            {
                FirstName              = "Nora",
                LastName               = "Al-Kuwari",
                Email                  = "nora.alkuwari@gmail.com",
                PasswordHash           = BCrypt.Net.BCrypt.HashPassword("Customer123!"),
                Phone                  = "+97450004444",
                HomeAddress            = "Al Sadd, Doha",
                WorkAddress            = "West Bay, Doha",
                PreferredAddressType   = "Home",
                Role                   = "Customer",
                IsActive               = true,
                CreatedAt              = now,
                UpdatedAt              = now,
            },
            new()
            {
                FirstName              = "Mazen",
                LastName               = "Ibrahim",
                Email                  = "mazen.ibrahim@gmail.com",
                PasswordHash           = BCrypt.Net.BCrypt.HashPassword("Customer123!"),
                Phone                  = "+97450005555",
                HomeAddress            = "Education City, Al Rayyan",
                PreferredAddressType   = "Home",
                Role                   = "Customer",
                IsActive               = true,
                CreatedAt              = now,
                UpdatedAt              = now,
            },
        };

        await db.Staff.AddRangeAsync(workers);
        await db.Users.AddRangeAsync(customers);

        // â”€â”€ Products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        var products = new List<Product>
        {
            new() { Name = "All-Purpose Cleaner",   Description = "Versatile cleaner for all surfaces",          Vendor = "DetailPro",     CostPerUnit = 0.91m,  Unit = "ml",   StockQuantity = 10000, IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Leather Conditioner",   Description = "Nourishes and protects leather",              Vendor = "LeatherGuard",  CostPerUnit = 1.10m,  Unit = "ml",   StockQuantity = 5000,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Glass Cleaner",         Description = "Streak-free window cleaner",                  Vendor = "SparkleAuto",   CostPerUnit = 0.73m,  Unit = "ml",   StockQuantity = 7500,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Car Wash Shampoo",      Description = "pH-neutral and high foam",                    Vendor = "ShineClean",    CostPerUnit = 0.55m,  Unit = "ml",   StockQuantity = 15000, IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Tire Dressing",         Description = "Long-lasting tire shine",                     Vendor = "BlackOut",      CostPerUnit = 1.02m,  Unit = "ml",   StockQuantity = 6000,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Paint Sealant 3M",      Description = "Durable 3-month paint protection",           Vendor = "SealGuard",     CostPerUnit = 1.46m,  Unit = "ml",   StockQuantity = 4000,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Ceramic Spray Sealant", Description = "6-month ceramic protection",                  Vendor = "CeramicShield", CostPerUnit = 2.01m,  Unit = "ml",   StockQuantity = 3000,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Clay Bar Kit",          Description = "Removes bonded contaminants",                 Vendor = "SmoothFinish",  CostPerUnit = 18.25m, Unit = "unit", StockQuantity = 1000,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Ozone Generator Rental",Description = "Equipment for odor elimination",              Vendor = "OdorGone",      CostPerUnit = 73.00m, Unit = "hour", StockQuantity = 50,    IsActive = true, CreatedAt = now, UpdatedAt = now },
        };
        await db.Products.AddRangeAsync(products);

        // â”€â”€ Services (30) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        var services = new List<Service>
        {
            // Interior
            new() { Name = "Detailed Vacuum",                     Description = "Detailed Vacuum of Floors, Carpets, and Trunk",                               DefaultDurationMinutes = 20,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Interior Wipe Down",                  Description = "Detailed Wipe Down of All Interior Surfaces",                                 DefaultDurationMinutes = 20,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Plastics Cleaned",                    Description = "Plastics (dash, door panels, etc) Cleaned",                                   DefaultDurationMinutes = 15,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Cracks & Crevices Cleaned",           Description = "All Cracks + Crevices Cleaned",                                               DefaultDurationMinutes = 10,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Floor Mats Cleaned",                  Description = "Floor Mats Cleaned",                                                          DefaultDurationMinutes = 5,   IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Leather Conditioned",                 Description = "Leather Cleaned & Conditioned",                                               DefaultDurationMinutes = 20,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Windows Cleaned (Interior)",          Description = "Windows Cleaned to Streak-Free Finish (Interior)",                            DefaultDurationMinutes = 10,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Door Jambs Cleaned",                  Description = "Door Jambs Cleaned",                                                          DefaultDurationMinutes = 10,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Trunk Cleaned",                       Description = "Trunk Cleaned",                                                               DefaultDurationMinutes = 10,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Air Freshener",                       Description = "Air Freshener (if requested)",                                                DefaultDurationMinutes = 2,   IsActive = true, CreatedAt = now, UpdatedAt = now },
            // Exterior
            new() { Name = "Professional Hand Wash + Foam Bath",  Description = "Professional Hand Wash + Foam Bath",                                          DefaultDurationMinutes = 30,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Bug Splatters Cleaned",               Description = "Bug Splatters Cleaned Off",                                                   DefaultDurationMinutes = 10,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Wheels + Rims Deep Cleaned",          Description = "Wheels + Rims Deep Cleaned",                                                  DefaultDurationMinutes = 20,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Tires Shined + Dressed",              Description = "Tires Shined + Dressed",                                                      DefaultDurationMinutes = 10,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "3 Month Paint Sealant",               Description = "3 Month Paint Sealant (protects + shines)",                                   DefaultDurationMinutes = 30,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Clay Bar Treatment",                  Description = "Clay Bar Treatment & Micro Contaminants Removed from Paint",                  DefaultDurationMinutes = 45,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Exterior Windows Cleaned",            Description = "Exterior Windows Cleaned",                                                    DefaultDurationMinutes = 10,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Plastic Trim Dressed & Shined",       Description = "Plastic Trim Dressed & Shined",                                               DefaultDurationMinutes = 15,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Ceramic Paint Sealant Applied",       Description = "Ceramic Paint Sealant Applied (long-lasting protection)",                     DefaultDurationMinutes = 60,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "6 Month Paint Sealant",               Description = "6 Month Paint Sealant (protects + shines)",                                   DefaultDurationMinutes = 45,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Premium Tire Dressing",               Description = "Premium Tire Dressing (more durable)",                                        DefaultDurationMinutes = 15,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Plastic Trim Coated & Dressed",       Description = "Plastic Trim Coated & Dressed (UV protectant + deep black finish)",           DefaultDurationMinutes = 20,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            // Specialist
            new() { Name = "Mold & Mildew Remediation",           Description = "Specialized service for mold and mildew removal",                             DefaultDurationMinutes = 120, IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Trim Restoration",                    Description = "Restoration of faded exterior plastic and rubber trim",                       DefaultDurationMinutes = 60,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Headlight Restoration",               Description = "Restores clarity to foggy and yellowed headlights",                           DefaultDurationMinutes = 45,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Carpet & Seat Extraction",            Description = "Deep cleaning of carpets and fabric seats using hot water extraction",        DefaultDurationMinutes = 90,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Ozone Treatment (Odor Elimination)",  Description = "Ozone treatment for permanent odor removal",                                  DefaultDurationMinutes = 60,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Clay Bar & Paint Decontamination",    Description = "Removes embedded contaminants from paint for a smooth finish",                DefaultDurationMinutes = 60,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Steam Cleaning (Whole Car)",          Description = "Sanitizing and cleaning various surfaces with steam",                         DefaultDurationMinutes = 90,  IsActive = true, CreatedAt = now, UpdatedAt = now },
            new() { Name = "Engine Bay Cleaning",                 Description = "Safe cleaning and dressing of the engine compartment",                        DefaultDurationMinutes = 45,  IsActive = true, CreatedAt = now, UpdatedAt = now },
        };
        await db.Services.AddRangeAsync(services);

        // â”€â”€ Packages (3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        var packages = new List<Package>
        {
            new()
            {
                Name                     = "Interior Detail",
                Description              = "Thorough interior detailing service. Your car interior will invite you with a fresh look, smell, & feel for a peaceful driving experience!",
                Price                    = 795.66m,
                Tier                     = "Standard",
                EstimatedDurationMinutes = 90,
                ImageUrl                 = "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=1200&q=80",
                IsActive                 = true,
                CreatedAt                = now,
                UpdatedAt                = now,
            },
            new()
            {
                Name                     = "Full Detail",
                Description              = "Full interior & exterior detail, designed to clean every inch of your car!",
                Price                    = 1113.21m,
                Tier                     = "Gold",
                EstimatedDurationMinutes = 180,
                ImageUrl                 = "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
                IsActive                 = true,
                CreatedAt                = now,
                UpdatedAt                = now,
            },
            new()
            {
                Name                     = "Exterior Detail",
                Description              = "Premium exterior detail designed to remove micro contaminants, leave a silky smooth finish, and protect paint for up to 8 months!",
                Price                    = 529.21m,
                Tier                     = "Standard",
                EstimatedDurationMinutes = 120,
                ImageUrl                 = "https://images.unsplash.com/photo-1485291571150-772bcfc10da5?auto=format&fit=crop&w=1200&q=80",
                IsActive                 = true,
                CreatedAt                = now,
                UpdatedAt                = now,
            },
        };
        await db.Packages.AddRangeAsync(packages);

        await db.SaveChangesAsync();

        // â”€â”€ Lookups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        var svc  = services.ToDictionary(s => s.Name);
        var prod = products.ToDictionary(p => p.Name);
        var pkg  = packages.ToDictionary(p => p.Name);

        var interior = pkg["Interior Detail"];
        var full     = pkg["Full Detail"];
        var exterior = pkg["Exterior Detail"];

        // â”€â”€ ServiceProducts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        await db.ServiceProducts.AddRangeAsync(new List<ServiceProduct>
        {
            // Interior services
            new() { ServiceId = svc["Detailed Vacuum"].Id,                    ProductId = prod["Car Wash Shampoo"].Id,       QuantityUsed = 50m  },
            new() { ServiceId = svc["Interior Wipe Down"].Id,                 ProductId = prod["All-Purpose Cleaner"].Id,    QuantityUsed = 30m  },
            new() { ServiceId = svc["Plastics Cleaned"].Id,                   ProductId = prod["Leather Conditioner"].Id,    QuantityUsed = 25m  },
            new() { ServiceId = svc["Leather Conditioned"].Id,                ProductId = prod["Leather Conditioner"].Id,    QuantityUsed = 40m  },
            new() { ServiceId = svc["Windows Cleaned (Interior)"].Id,         ProductId = prod["Glass Cleaner"].Id,          QuantityUsed = 60m  },
            // Exterior services
            new() { ServiceId = svc["Professional Hand Wash + Foam Bath"].Id, ProductId = prod["Car Wash Shampoo"].Id,       QuantityUsed = 100m },
            new() { ServiceId = svc["Wheels + Rims Deep Cleaned"].Id,         ProductId = prod["Tire Dressing"].Id,          QuantityUsed = 50m  },
            new() { ServiceId = svc["Clay Bar Treatment"].Id,                 ProductId = prod["Clay Bar Kit"].Id,           QuantityUsed = 1m   },
            new() { ServiceId = svc["Ceramic Paint Sealant Applied"].Id,      ProductId = prod["Ceramic Spray Sealant"].Id,  QuantityUsed = 30m  },
            new() { ServiceId = svc["6 Month Paint Sealant"].Id,              ProductId = prod["Paint Sealant 3M"].Id,       QuantityUsed = 25m  },
            new() { ServiceId = svc["Plastic Trim Coated & Dressed"].Id,      ProductId = prod["Tire Dressing"].Id,          QuantityUsed = 35m  },
            new() { ServiceId = svc["Ozone Treatment (Odor Elimination)"].Id, ProductId = prod["Ozone Generator Rental"].Id, QuantityUsed = 2m   },
        });

        // â”€â”€ PackageServices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Interior Detail: services 1â€“10
        await db.PackageServices.AddRangeAsync(new List<PackageService>
        {
            new() { PackageId = interior.Id, ServiceId = svc["Detailed Vacuum"].Id            },
            new() { PackageId = interior.Id, ServiceId = svc["Interior Wipe Down"].Id         },
            new() { PackageId = interior.Id, ServiceId = svc["Plastics Cleaned"].Id           },
            new() { PackageId = interior.Id, ServiceId = svc["Cracks & Crevices Cleaned"].Id  },
            new() { PackageId = interior.Id, ServiceId = svc["Floor Mats Cleaned"].Id         },
            new() { PackageId = interior.Id, ServiceId = svc["Leather Conditioned"].Id        },
            new() { PackageId = interior.Id, ServiceId = svc["Windows Cleaned (Interior)"].Id },
            new() { PackageId = interior.Id, ServiceId = svc["Door Jambs Cleaned"].Id         },
            new() { PackageId = interior.Id, ServiceId = svc["Trunk Cleaned"].Id              },
            new() { PackageId = interior.Id, ServiceId = svc["Air Freshener"].Id              },

            // Full Detail: interior + key exterior
            new() { PackageId = full.Id, ServiceId = svc["Detailed Vacuum"].Id                    },
            new() { PackageId = full.Id, ServiceId = svc["Interior Wipe Down"].Id                 },
            new() { PackageId = full.Id, ServiceId = svc["Plastics Cleaned"].Id                   },
            new() { PackageId = full.Id, ServiceId = svc["Cracks & Crevices Cleaned"].Id          },
            new() { PackageId = full.Id, ServiceId = svc["Floor Mats Cleaned"].Id                 },
            new() { PackageId = full.Id, ServiceId = svc["Leather Conditioned"].Id                },
            new() { PackageId = full.Id, ServiceId = svc["Windows Cleaned (Interior)"].Id         },
            new() { PackageId = full.Id, ServiceId = svc["Door Jambs Cleaned"].Id                 },
            new() { PackageId = full.Id, ServiceId = svc["Trunk Cleaned"].Id                      },
            new() { PackageId = full.Id, ServiceId = svc["Air Freshener"].Id                      },
            new() { PackageId = full.Id, ServiceId = svc["Professional Hand Wash + Foam Bath"].Id },
            new() { PackageId = full.Id, ServiceId = svc["Bug Splatters Cleaned"].Id              },
            new() { PackageId = full.Id, ServiceId = svc["Wheels + Rims Deep Cleaned"].Id         },
            new() { PackageId = full.Id, ServiceId = svc["Tires Shined + Dressed"].Id             },
            new() { PackageId = full.Id, ServiceId = svc["3 Month Paint Sealant"].Id              },

            // Exterior Detail: exterior services
            new() { PackageId = exterior.Id, ServiceId = svc["Professional Hand Wash + Foam Bath"].Id },
            new() { PackageId = exterior.Id, ServiceId = svc["Bug Splatters Cleaned"].Id              },
            new() { PackageId = exterior.Id, ServiceId = svc["Clay Bar Treatment"].Id                 },
            new() { PackageId = exterior.Id, ServiceId = svc["Exterior Windows Cleaned"].Id           },
            new() { PackageId = exterior.Id, ServiceId = svc["Wheels + Rims Deep Cleaned"].Id         },
            new() { PackageId = exterior.Id, ServiceId = svc["Plastic Trim Dressed & Shined"].Id      },
            new() { PackageId = exterior.Id, ServiceId = svc["Ceramic Paint Sealant Applied"].Id      },
            new() { PackageId = exterior.Id, ServiceId = svc["6 Month Paint Sealant"].Id              },
            new() { PackageId = exterior.Id, ServiceId = svc["Premium Tire Dressing"].Id              },
            new() { PackageId = exterior.Id, ServiceId = svc["Plastic Trim Coated & Dressed"].Id      },
        });

        // â”€â”€ System Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        await db.SystemSettings.AddRangeAsync(new List<SystemSetting>
        {
            new() { Key = "pricing.vehicleMultipliers",       Value = "{\"Motorcycle\":0.8,\"Sedan\":1.0,\"SUV\":1.25,\"Pickup\":1.5}", UpdatedAt = now },
            new() { Key = "booking.workerTravelBufferMinutes",Value = "30",  UpdatedAt = now },
            new() { Key = "booking.businessHours",           Value = JsonSerializer.Serialize(new BusinessHoursPerDayDto()), UpdatedAt = now },
            new() { Key = "payslip.companyName",         Value = "Glanz", UpdatedAt = now },
            new() { Key = "payslip.companyLogo",        Value = "",      UpdatedAt = now },
            new() { Key = "payslip.companyAddress",      Value = "Qatar", UpdatedAt = now },
            new() { Key = "payslip.companyPhone",      Value = "+974XXXXXXXX", UpdatedAt = now },
            new() { Key = "payslip.companyEmail",      Value = "info@glanz.qa", UpdatedAt = now },
            new() { Key = "payslip.footerText",       Value = "Thank you for your hard work!", UpdatedAt = now },
        });

        await db.SaveChangesAsync();

        // ── Development test coupon ──────────────────────────────────────────────
        // FREEDEV100 gives 100% off so developers can test the full booking + payment
        // flow without real money. All backend validation still runs (single-use per
        // redemption, user-bound once assigned via admin panel, etc.).
        var devOffer = new Offer
        {
            Name             = "Dev Test Coupon (100% off)",
            Code             = "FREEDEV100",
            Description      = "Seeded dev coupon — 100% off for testing the full booking + payment flow.",
            DiscountType     = DiscountType.Percentage,
            DiscountValue    = 100,
            MinBookingAmount = 0,
            IsLoyaltyProgram = false,
            IsActive         = true,
            MaxUsesPerUser   = 3, // enough for smoke testing, small enough to surface real issues
            CreatedAt        = now,
            UpdatedAt        = now,
        };
        await db.Offers.AddAsync(devOffer);
        await db.SaveChangesAsync();

        // â”€â”€ Bookings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        await SeedBookingsAsync(db, workers, customers, pkg, now);
    }

    private static async Task SeedBookingsAsync(
        AppDbContext db,
        List<Staff> workers,
        List<User> customers,
        Dictionary<string, Package> pkg,
        DateTime now)
    {
        static DateTime StartOfWeekUtc(DateTime utcDate, DayOfWeek weekStartsOn)
        {
            var date = utcDate.Date;
            var diff = (7 + (date.DayOfWeek - weekStartsOn)) % 7;
            return date.AddDays(-diff);
        }

        static DateTime UtcAt(DateTime day, int hour, int minute = 0)
            => new(day.Year, day.Month, day.Day, hour, minute, 0, DateTimeKind.Utc);

        // Cost constants derived from ServiceProduct chain (qty Ã— costPerUnit, summed per package):
        //   Interior Detail : QAR 170.10  (services 1â€“10)
        //   Full Detail     : QAR 276.10  (services 1â€“15)
        //   Exterior Detail : QAR 256.75  (services 11,12,13,16â€“22)
        const decimal interiorCost = 170.10m;
        const decimal fullCost     = 276.10m;
        const decimal exteriorCost = 256.75m;

        var ahmed  = workers[0];
        var sara   = workers[1];
        var khalid = customers[0];
        var fatima = customers[1];
        var omar   = customers[2];
        var nora   = customers[3];
        var mazen  = customers[4];

        var interior = pkg["Interior Detail"];
        var full     = pkg["Full Detail"];
        var exterior = pkg["Exterior Detail"];

        // Keep seeded data always relevant to current date:
        // - completed jobs in previous week (Sun-Thu)
        // - active/pending jobs in next week (Sun-Thu)
        var nextWeekSunday = StartOfWeekUtc(now, DayOfWeek.Sunday).AddDays(7);
        var prevWeekSunday = nextWeekSunday.AddDays(-7);

        // Vehicle multipliers: Sedan=1.0, SUV=1.25
        // TotalAmount = Math.Round(package.Price * multiplier, 2)

        var bookingDefs = new[]
        {
            // â”€â”€ Previous week: Completed / Paid â€” for payroll + financial history â”€â”€
            new BookingDef(
                "SEED-001",
                UtcAt(prevWeekSunday.AddDays(1), 12), "09:00-10:30",
                khalid, ahmed, interior, VehicleType.Sedan, 1.00m,
                "Toyota", "Camry", "2022", interiorCost,
                khalid.HomeAddress!, "Home",
                BookingStatus.Completed, PaymentStatus.Paid,
                UtcAt(prevWeekSunday.AddDays(1), 9, 0),
                UtcAt(prevWeekSunday.AddDays(1), 10, 28)),

            new BookingDef(
                "SEED-002",
                UtcAt(prevWeekSunday.AddDays(2), 12), "10:00-13:00",
                fatima, sara, full, VehicleType.SUV, 1.25m,
                "Nissan", "Patrol", "2023", fullCost,
                fatima.WorkAddress!, "Work",
                BookingStatus.Completed, PaymentStatus.Paid,
                UtcAt(prevWeekSunday.AddDays(2), 10, 0),
                UtcAt(prevWeekSunday.AddDays(2), 12, 55)),

            new BookingDef(
                "SEED-003",
                UtcAt(prevWeekSunday.AddDays(3), 12), "09:00-11:00",
                mazen, ahmed, exterior, VehicleType.Sedan, 1.00m,
                "Honda", "Accord", "2022", exteriorCost,
                mazen.HomeAddress!, "Home",
                BookingStatus.Completed, PaymentStatus.Paid,
                UtcAt(prevWeekSunday.AddDays(3), 9, 0),
                UtcAt(prevWeekSunday.AddDays(3), 11, 5)),

            new BookingDef(
                "SEED-004",
                UtcAt(prevWeekSunday.AddDays(4), 12), "10:00-11:30",
                nora, sara, interior, VehicleType.SUV, 1.25m,
                "Kia", "Sportage", "2024", interiorCost,
                nora.HomeAddress!, "Home",
                BookingStatus.Completed, PaymentStatus.Paid,
                UtcAt(prevWeekSunday.AddDays(4), 10, 0),
                UtcAt(prevWeekSunday.AddDays(4), 11, 33)),

            // â”€â”€ Next week: Sunâ€“Thu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            new BookingDef(
                "SEED-005",
                UtcAt(nextWeekSunday, 12), "09:00-10:30",
                khalid, ahmed, interior, VehicleType.Sedan, 1.00m,
                "Toyota", "Camry", "2022", interiorCost,
                khalid.HomeAddress!, "Home",
                BookingStatus.Confirmed, PaymentStatus.PreAuthorized,
                null, null),

            new BookingDef(
                "SEED-006",
                UtcAt(nextWeekSunday, 12), "10:00-12:00",
                fatima, sara, exterior, VehicleType.SUV, 1.25m,
                "Nissan", "Patrol", "2023", exteriorCost,
                fatima.WorkAddress!, "Work",
                BookingStatus.Confirmed, PaymentStatus.PreAuthorized,
                null, null),

            new BookingDef(
                "SEED-007",
                UtcAt(nextWeekSunday.AddDays(1), 12), "09:00-12:00",
                omar, ahmed, full, VehicleType.SUV, 1.25m,
                "BMW", "X5", "2021", fullCost,
                omar.HomeAddress!, "Home",
                BookingStatus.Confirmed, PaymentStatus.Paid,
                null, null),

            new BookingDef(
                "SEED-008",
                UtcAt(nextWeekSunday.AddDays(1), 12), "10:00-11:30",
                nora, sara, interior, VehicleType.SUV, 1.25m,
                "Kia", "Sportage", "2024", interiorCost,
                nora.HomeAddress!, "Home",
                BookingStatus.Pending, PaymentStatus.PreAuthorized,
                null, null),

            new BookingDef(
                "SEED-009",
                UtcAt(nextWeekSunday.AddDays(2), 12), "09:00-11:00",
                mazen, ahmed, exterior, VehicleType.Sedan, 1.00m,
                "Honda", "Accord", "2022", exteriorCost,
                mazen.HomeAddress!, "Home",
                BookingStatus.Confirmed, PaymentStatus.PreAuthorized,
                null, null),

            new BookingDef(
                "SEED-010",
                UtcAt(nextWeekSunday.AddDays(2), 12), "10:00-13:00",
                khalid, sara, full, VehicleType.SUV, 1.25m,
                "Mercedes", "GLC", "2023", fullCost,
                khalid.HomeAddress!, "Home",
                BookingStatus.Confirmed, PaymentStatus.Paid,
                null, null),

            new BookingDef(
                "SEED-011",
                UtcAt(nextWeekSunday.AddDays(3), 12), "09:00-10:30",
                fatima, ahmed, interior, VehicleType.SUV, 1.25m,
                "Toyota", "Land Cruiser", "2022", interiorCost,
                fatima.HomeAddress!, "Home",
                BookingStatus.Pending, PaymentStatus.PreAuthorized,
                null, null),

            new BookingDef(
                "SEED-012",
                UtcAt(nextWeekSunday.AddDays(4), 12), "10:00-12:00",
                omar, sara, exterior, VehicleType.Sedan, 1.00m,
                "Hyundai", "Elantra", "2024", exteriorCost,
                omar.HomeAddress!, "Home",
                BookingStatus.Pending, PaymentStatus.PreAuthorized,
                null, null),
        };

        // Build PackageService label lookup: packageId -> list of service names
        var packageServiceNames = await db.PackageServices
            .Include(ps => ps.Service)
            .GroupBy(ps => ps.PackageId)
            .ToDictionaryAsync(
                g => g.Key,
                g => g.Select(ps => ps.Service.Name).OrderBy(n => n).ToList());

        foreach (var def in bookingDefs)
        {
            var totalAmount = Math.Round(def.Package.Price * def.VehicleMultiplier, 2);
            var profit      = totalAmount - def.EstimatedCost;

            var booking = new Booking
            {
                BookingNumber       = def.BookingNumber,
                UserId              = def.Customer.Id,
                ScheduledDate       = def.ScheduledDate,
                TimeSlot            = def.TimeSlot,
                Status              = def.Status,
                PaymentStatus       = def.PaymentStatus,
                TotalAmount         = totalAmount,
                DiscountAmount      = 0m,
                EstimatedCost       = def.EstimatedCost,
                EstimatedProfit     = profit,
                CustomerName        = $"{def.Customer.FirstName} {def.Customer.LastName}",
                CustomerEmail       = def.Customer.Email,
                CustomerPhone       = def.Customer.Phone!,
                CustomerAddress     = def.CustomerAddress,
                AddressType         = def.AddressType,
                VehicleMake         = def.VehicleMake,
                VehicleModel        = def.VehicleModel,
                VehicleYear         = def.VehicleYear,
                VehicleType         = def.VehicleType,
                AssignedWorkerId    = def.Worker.Id,
                WorkStartedAt       = def.WorkStartedAt,
                WorkCompletedAt     = def.WorkCompletedAt,
                WorkDurationSeconds = def.WorkStartedAt.HasValue && def.WorkCompletedAt.HasValue
                    ? (int)(def.WorkCompletedAt.Value - def.WorkStartedAt.Value).TotalSeconds
                    : null,
                StockDeductedAt     = def.Status == BookingStatus.Completed ? def.WorkCompletedAt : null,
                CreatedAt           = now,
                UpdatedAt           = now,
            };

            await db.Bookings.AddAsync(booking);
            await db.SaveChangesAsync();

            // BookingItem
            await db.BookingItems.AddAsync(new BookingItem
            {
                BookingId               = booking.Id,
                PackageId               = def.Package.Id,
                Price                   = totalAmount,
                Quantity                = 1,
                SnapshotDurationMinutes = def.Package.EstimatedDurationMinutes,
                ItemCost                = def.EstimatedCost,
            });

            // BookingChecklistItems
            if (packageServiceNames.TryGetValue(def.Package.Id, out var svcNames))
            {
                var checklistItems = svcNames
                    .Select((name, idx) => new BookingChecklistItem
                    {
                        BookingId    = booking.Id,
                        Label        = $"{def.Package.Name}: {name}",
                        DisplayOrder = idx + 1,
                        IsCompleted  = def.Status == BookingStatus.Completed,
                        CompletedAt  = def.Status == BookingStatus.Completed ? def.WorkCompletedAt : null,
                    })
                    .ToList();

                await db.BookingChecklistItems.AddRangeAsync(checklistItems);
            }

            await db.SaveChangesAsync();
        }
    }

    private sealed record BookingDef(
        string BookingNumber,
        DateTime ScheduledDate,
        string TimeSlot,
        User Customer,
        Staff Worker,
        Package Package,
        VehicleType VehicleType,
        decimal VehicleMultiplier,
        string VehicleMake,
        string VehicleModel,
        string VehicleYear,
        decimal EstimatedCost,
        string CustomerAddress,
        string AddressType,
        BookingStatus Status,
        PaymentStatus PaymentStatus,
        DateTime? WorkStartedAt,
        DateTime? WorkCompletedAt);
}

