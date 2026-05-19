using System.Text.RegularExpressions;

namespace Flowly.API.Helpers
{
    public static class ShortCodeHelper
    {
        /// <summary>
        /// Generates the first short code not present in existingCodes using the priority cascade.
        /// All codes returned are exactly 4 uppercase alphanumeric characters.
        /// </summary>
        public static string GenerateShortCode(string firstName, string lastName, ISet<string> existingCodes)
        {
            foreach (var candidate in Candidates(firstName, lastName))
            {
                if (!existingCodes.Contains(candidate))
                    return candidate;
            }
            return "XXXX"; // unreachable in practice
        }

        /// <summary>Yields 4-char candidate codes in priority order (no collision check).</summary>
        public static IEnumerable<string> Candidates(string firstName, string lastName)
        {
            var fn = Regex.Replace(firstName.ToUpperInvariant(), "[^A-Z0-9]", "");
            var ln = Regex.Replace(lastName.ToUpperInvariant(), "[^A-Z0-9]", "");

            // 1: fn[0..2] + ln[0..2]
            if (fn.Length >= 2 && ln.Length >= 2)
                yield return fn[..2] + ln[..2];

            // 2: fn[0..3] + ln[0]
            if (fn.Length >= 3 && ln.Length >= 1)
                yield return fn[..3] + ln[..1];

            // 3: fn[0] + ln[0..3]
            if (fn.Length >= 1 && ln.Length >= 3)
                yield return fn[..1] + ln[..3];

            // 4: fn[0..2] + ln[1..3]
            if (fn.Length >= 2 && ln.Length >= 3)
                yield return fn[..2] + ln[1..3];

            // 5: fn[0..4]
            if (fn.Length >= 4)
                yield return fn[..4];

            // 6: ln[0..4]
            if (ln.Length >= 4)
                yield return ln[..4];

            // 7+: first 3 chars of attempt-1 result + incrementing digit
            var base3 = fn.Length >= 2 && ln.Length >= 2
                ? (fn[..2] + ln[..2])[..3]
                : (fn + ln).PadRight(3)[..3];

            // i 2-9 = 1-digit suffix → 3+1 = 4 chars; i 10-99 = 2-digit suffix → use base2 to keep total at 4
            var base2 = (fn + ln).PadRight(2)[..2];
            for (int i = 2; i <= 9; i++)
                yield return base3 + i.ToString();
            for (int i = 10; i <= 99; i++)
                yield return base2 + i.ToString();
        }
    }
}
