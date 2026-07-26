using GlutenScanner.Api.Config;
using GlutenScanner.Api.Data;
using GlutenScanner.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GlutenScanner.Api.Services;

/// <summary>
/// Credits XP when barcode reports are applied to the live catalog.
/// </summary>
public static class XpRewardService
{
    public const int BarcodeReportXpAmount = 10;
    public const int ProductSubmissionXpAmount = 20;

    /// <summary>
    /// Awards <see cref="BarcodeReportXpAmount"/> XP to every distinct reporter whose
    /// matching barcode report was just applied. Logs each credit in
    /// <c>xp_progress</c> and promotes <see cref="User.Level"/> when XP crosses the
    /// next threshold in <see cref="LevelProgressTable"/> (admins at level 100+ are
    /// never demoted).
    /// </summary>
    public static async Task AwardForAppliedBarcodeReportsAsync(
        AppDbContext appDb,
        LevelProgressTable levelProgress,
        IEnumerable<BarcodeReport> appliedReports,
        CancellationToken cancellationToken = default)
    {
        var reports = appliedReports
            .Where(r => r.Applied && r.ReportedByUserId is not null && r.Id > 0)
            .GroupBy(r => r.ReportedByUserId!.Value)
            .Select(g => g.OrderByDescending(r => r.Id).First())
            .ToList();

        if (reports.Count == 0)
        {
            return;
        }

        var reportIds = reports.Select(r => r.Id).ToList();
        var alreadyAwarded = await appDb.XpProgress
            .Where(x => x.BarcodeReportId != null && reportIds.Contains(x.BarcodeReportId.Value))
            .Select(x => x.BarcodeReportId!.Value)
            .ToListAsync(cancellationToken);
        var awardedSet = alreadyAwarded.ToHashSet();

        var pending = reports.Where(r => !awardedSet.Contains(r.Id)).ToList();
        if (pending.Count == 0)
        {
            return;
        }

        var userIds = pending.Select(r => r.ReportedByUserId!.Value).Distinct().ToList();
        var users = await appDb.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        var now = DateTime.UtcNow;
        foreach (var report in pending)
        {
            var userId = report.ReportedByUserId!.Value;
            if (!users.TryGetValue(userId, out var user))
            {
                continue;
            }

            user.Xp += BarcodeReportXpAmount;
            user.UpdatedAt = now;

            // Promote from the XP ladder only — never touch admin (100+) ranks,
            // and never demote a higher manually assigned level.
            if (user.Level < User.AdminLevel)
            {
                var xpLevel = levelProgress.GetLevelForXp(user.Xp);
                if (xpLevel > user.Level)
                {
                    user.Level = xpLevel;
                }
            }

            appDb.XpProgress.Add(new XpProgress
            {
                UserId = userId,
                XpAmount = BarcodeReportXpAmount,
                BarcodeReportId = report.Id,
                ProductSubmissionId = null,
                CreatedAt = now,
            });
        }

        await appDb.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Awards XP when an admin applies a pending product submission to the catalog.
    /// </summary>
    public static async Task AwardForApprovedProductSubmissionAsync(
        AppDbContext appDb,
        LevelProgressTable levelProgress,
        ProductSubmission submission,
        CancellationToken cancellationToken = default)
    {
        if (submission.Id <= 0 || submission.SubmittedByUserId <= 0)
        {
            return;
        }

        var alreadyAwarded = await appDb.XpProgress.AnyAsync(
            x => x.ProductSubmissionId == submission.Id,
            cancellationToken);
        if (alreadyAwarded)
        {
            return;
        }

        var user = await appDb.Users.FirstOrDefaultAsync(
            u => u.Id == submission.SubmittedByUserId,
            cancellationToken);
        if (user is null)
        {
            return;
        }

        var now = DateTime.UtcNow;
        user.Xp += ProductSubmissionXpAmount;
        user.UpdatedAt = now;

        if (user.Level < User.AdminLevel)
        {
            var xpLevel = levelProgress.GetLevelForXp(user.Xp);
            if (xpLevel > user.Level)
            {
                user.Level = xpLevel;
            }
        }

        appDb.XpProgress.Add(new XpProgress
        {
            UserId = user.Id,
            XpAmount = ProductSubmissionXpAmount,
            BarcodeReportId = null,
            ProductSubmissionId = submission.Id,
            CreatedAt = now,
        });

        await appDb.SaveChangesAsync(cancellationToken);
    }
}
