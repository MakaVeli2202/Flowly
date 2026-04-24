using FluentValidation;
using Glanz.API.DTOs;
using Glanz.API.Models;

namespace Glanz.API.Validators;

public class CreateVehicleDtoValidator : AbstractValidator<CreateVehicleDto>
{
    public CreateVehicleDtoValidator()
    {
        RuleFor(x => x.Nickname)
            .MaximumLength(100);

        RuleFor(x => x.Make)
            .MaximumLength(100);

        RuleFor(x => x.Model)
            .MaximumLength(100);

        RuleFor(x => x.Year)
            .Matches(@"^\d{4}$").WithMessage("Year must be a 4-digit year")
            .When(x => !string.IsNullOrEmpty(x.Year));

        RuleFor(x => x.Color)
            .MaximumLength(50);

        RuleFor(x => x.PlateNumber)
            .MaximumLength(50);

        RuleFor(x => x.VehicleType)
            .IsInEnum();
    }
}