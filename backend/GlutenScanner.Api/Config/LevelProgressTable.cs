using System.Text.Json;
using System.Text.Json.Serialization;

namespace GlutenScanner.Api.Config;

/// <summary>
/// One rung on the XP → level ladder. A user is on this level when
/// <c>minXp &lt;= xp &lt; maxXp</c> (max is exclusive so adjacent rows can share a boundary).
/// Edit <c>Config/level-progress.json</c> to change thresholds — no code change needed.
/// </summary>
public sealed class LevelProgressEntry
{
    [JsonPropertyName("level")]
    public int Level { get; init; }

    [JsonPropertyName("minXp")]
    public int MinXp { get; init; }

    [JsonPropertyName("maxXp")]
    public int MaxXp { get; init; }
}

public sealed class LevelProgressFile
{
    [JsonPropertyName("levels")]
    public List<LevelProgressEntry> Levels { get; init; } = new();
}

/// <summary>
/// Hardcoded level ladder loaded from <c>Config/level-progress.json</c> at startup.
/// Change XP ranges in that JSON file whenever you want to retune progression.
/// </summary>
public sealed class LevelProgressTable
{
    public const string RelativePath = "Config/level-progress.json";

    private readonly IReadOnlyList<LevelProgressEntry> _levels;

    public LevelProgressTable(IReadOnlyList<LevelProgressEntry> levels)
    {
        if (levels.Count == 0)
        {
            throw new InvalidOperationException("level-progress.json must define at least one level.");
        }

        _levels = levels.OrderBy(l => l.Level).ToList();
    }

    public IReadOnlyList<LevelProgressEntry> Levels => _levels;

    /// <summary>
    /// Resolves which level an XP total falls into. XP below the first min uses level 1;
    /// XP at or above the last max uses the highest defined level.
    /// </summary>
    public int GetLevelForXp(int xp)
    {
        foreach (var entry in _levels)
        {
            if (xp >= entry.MinXp && xp < entry.MaxXp)
            {
                return entry.Level;
            }
        }

        if (xp < _levels[0].MinXp)
        {
            return _levels[0].Level;
        }

        return _levels[^1].Level;
    }

    /// <summary>Returns the ladder rung for the given XP total.</summary>
    public LevelProgressEntry GetEntryForXp(int xp)
    {
        var level = GetLevelForXp(xp);
        return _levels.First(e => e.Level == level);
    }

    public static LevelProgressTable LoadFromContentRoot(string contentRootPath)
    {
        var path = Path.Combine(contentRootPath, RelativePath);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException(
                $"Missing level progress file. Edit thresholds in Config/level-progress.json.",
                path);
        }

        var json = File.ReadAllText(path);
        var file = JsonSerializer.Deserialize<LevelProgressFile>(json)
            ?? throw new InvalidOperationException("level-progress.json could not be parsed.");

        return new LevelProgressTable(file.Levels);
    }
}
