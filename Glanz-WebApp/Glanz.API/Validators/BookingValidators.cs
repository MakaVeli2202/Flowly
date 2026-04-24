using FluentValidation;
using Glanz.API.DTOs;
using Glanz.API.Models;

namespace Glanz.API.Validators;

public class CreateBookingDtoValidator : AbstractValidator<CreateBookingDto>
{
    public CreateBookingDtoValidator()
    {
        RuleFor(x => x.ScheduledDate)
            .NotEmpty().WithMessage("Scheduled date is required")
            .Must(d => d.Date >= DateTime.UtcNow.Date).WithMessage("Cannot book for past dates");

        RuleFor(x => x.TimeSlot)
            .NotEmpty().WithMessage("Time slot is required")
            .Matches(@"^\d{2}:\d{2}-\d{2}:\d{2}$").WithMessage("Invalid time slot format (expected HH:MM-HH:MM)");

        RuleFor(x => x.CustomerName)
            .NotEmpty().WithMessage("Customer name is required")
            .MaximumLength(200);

        RuleFor(x => x.CustomerEmail)
            .NotEmpty().WithMessage("Customer email is required")
            .EmailAddress();

        RuleFor(x => x.CustomerPhone)
            .NotEmpty().WithMessage("Customer phone is required")
            .Matches(@"^\+?[0-9]{8,15}$");

        RuleFor(x => x.VehicleType)
            .IsInEnum().WithMessage("Invalid vehicle type");

        RuleFor(x => x.SubscriptionMonths)
            .InclusiveBetween(1, 12).When(x => x.IsMonthlySubscription);

        RuleFor(x => x.Packages)
            .NotEmpty().WithMessage("At least one package is required");

        RuleForEach(x => x.Packages).SetValidator(new BookingPackageDtoValidator());
    }
}

public class BookingPackageDtoValidator : AbstractValidator<BookingPackageDto>
{
    public BookingPackageDtoValidator()
    {
        RuleFor(x => x.PackageId)
            .GreaterThan(0).WithMessage("Invalid package ID");

        RuleFor(x => x.Quantity)
            .InclusiveBetween(1, 10).WithMessage("Quantity must be between 1 and 10");
    }
}

public class ConfirmBookingDtoValidator : AbstractValidator<ConfirmBookingDto>
{
    public ConfirmBookingDtoValidator()
    {
        RuleFor(x => x.PaymentIntentId)
            .NotEmpty().WithMessage("Payment intent ID is required");
    }
}

public class MarkRunningLateDtoValidator : AbstractValidator<MarkRunningLateDto>
{
    public MarkRunningLateDtoValidator()
    {
        RuleFor(x => x.DelayMinutes)
            .InclusiveBetween(5, 120).WithMessage("Delay must be between 5 and 120 minutes");

        RuleFor(x => x.Reason)
            .MaximumLength(250).When(x => x.Reason != null);
    }
}