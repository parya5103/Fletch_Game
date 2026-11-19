package com.aaryapratik.arrowout.nativeapp.presentation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aaryapratik.arrowout.nativeapp.domain.model.ArrowGameState

internal data class ArrowOutWorld(
    val id: Int,
    val title: String,
    val subtitle: String,
    val guardian: String,
    val biome: String,
    val firstLevel: Int,
    val lastLevel: Int,
    val story: String
) {
    val rangeLabel: String get() = "Levels $firstLevel–$lastLevel"
}

internal object ArrowOutWorldCatalog {
    val worlds = listOf(
        ArrowOutWorld(1, "Whisperwind Meadow", "Sunlit glades and whispering waystones", "Lyra · the Songkeeper", "Meadow", 1, 125, "Restore the meadow's lost song by freeing each winding arrow."),
        ArrowOutWorld(2, "Tidecaller Coast", "The living tide and its quiet coves", "Orin · of the Living Tide", "Coast", 126, 250, "Unblock the old channels and let the coast breathe again."),
        ArrowOutWorld(3, "Stormveil Woods", "A forest caught inside a looping storm", "Kaelen · the Verdant Warden", "Forest", 251, 375, "Unwind the crooked paths and release the storm from the trees."),
        ArrowOutWorld(4, "Moonlit Ruins", "Ancient stones beneath a waiting moon", "Selene · the Moonwarden", "Ruins", 376, 500, "Carefully unbind the moonlit ruins, one clear path at a time."),
        ArrowOutWorld(5, "Zephyr Skies", "Cloudward fleets and open skies", "Captain Zephyr", "Sky", 501, 625, "Free the fleet's tangled ropes and send the ships back into the wind."),
        ArrowOutWorld(6, "Emberforge Peaks", "A sleeping forge beneath the mountains", "Valkor · the Forgemaster", "Volcanic", 626, 750, "Clear the forge vents and bring warmth back to the peaks."),
        ArrowOutWorld(7, "Eclipse Sanctum", "A sanctuary held between light and shadow", "Archmage Thalor", "Eclipse", 751, 875, "Unbind the arches and let dawn return to the sanctum."),
        ArrowOutWorld(8, "Starfall Court", "A constellation waiting to fall into place", "Queen Astraea", "Cosmic", 876, 1000, "Untangle the stars and complete the fletcher's thousand-level journey.")
    )

    fun forLevel(level: Int): ArrowOutWorld = worlds.first { level in it.firstLevel..it.lastLevel }
    fun byId(id: Int): ArrowOutWorld? = worlds.firstOrNull { it.id == id }
}

@Composable
internal fun ArrowOutHomeScreen(
    state: ArrowGameState,
    isRestoring: Boolean,
    onContinue: () -> Unit,
    onWorlds: () -> Unit,
    onDaily: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState()).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Spacer(Modifier.height(28.dp))
        Text("ARROW OUT", style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.onBackground)
        Text("A winding path puzzle", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("1,000 handcrafted-by-generator levels · 8 magical worlds", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(12.dp))
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
            Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("YOUR JOURNEY", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                Text("Level ${state.level} of 1,000", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onSurface)
                Text("${state.unlockedLevel} levels unlocked · ${state.coins} coins · ${state.dailyStreak}-day daily streak", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Button(onClick = onContinue, enabled = !isRestoring, modifier = Modifier.fillMaxWidth()) {
                    Text(if (isRestoring) "Restoring progress…" else if (state.isSolved) "Continue to Level ${(state.level + 1).coerceAtMost(1000)}" else "Continue playing")
                }
            }
        }
        OutlinedButton(onClick = onWorlds, modifier = Modifier.fillMaxWidth()) { Text("Explore 8 Worlds") }
        OutlinedButton(onClick = onDaily, enabled = !isRestoring, modifier = Modifier.fillMaxWidth()) { Text("Daily Challenge") }
        Text("Your progress is saved on this device and works offline.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
internal fun ArrowOutWorldMapScreen(
    state: ArrowGameState,
    onBack: () -> Unit,
    onWorldSelected: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = onBack) { Text("Home") }
            Text("  WORLD MAP", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground)
        }
        Text("Eight realms · 125 levels in each world", Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            ArrowOutWorldCatalog.worlds.forEach { world ->
                val unlocked = state.unlockedLevel >= world.firstLevel
                val cleared = (world.firstLevel..world.lastLevel).count { (state.bestStars[it] ?: 0) > 0 }
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    border = BorderStroke(1.dp, if (unlocked) MaterialTheme.colorScheme.primary.copy(alpha = 0.45f) else MaterialTheme.colorScheme.outlineVariant)
                ) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("WORLD ${world.id} · ${world.biome.uppercase()}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                        Text(world.title, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
                        Text(world.guardian, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurface)
                        Text(world.story, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("${world.rangeLabel} · $cleared / 125 cleared", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Button(onClick = { onWorldSelected(world.id) }, enabled = unlocked, modifier = Modifier.fillMaxWidth()) {
                            Text(if (unlocked) "View levels" else "Locked · reach level ${world.firstLevel}")
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun ArrowOutLevelSelectScreen(
    state: ArrowGameState,
    world: ArrowOutWorld,
    onBack: () -> Unit,
    onLevelSelected: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = onBack) { Text("Worlds") }
            Text("  WORLD ${world.id}", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground)
        }
        Text(world.title, Modifier.padding(top = 8.dp), style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onBackground)
        Text("${world.guardian} · ${world.rangeLabel}", Modifier.padding(bottom = 12.dp), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 58.dp),
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items((world.firstLevel..world.lastLevel).toList()) { level ->
                val unlocked = level <= state.unlockedLevel
                val stars = state.bestStars[level] ?: 0
                Surface(
                    onClick = { onLevelSelected(level) },
                    enabled = unlocked,
                    shape = RoundedCornerShape(12.dp),
                    color = if (unlocked) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, if (level == state.level) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant)
                ) {
                    Column(Modifier.padding(vertical = 12.dp, horizontal = 4.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(if (unlocked) level.toString() else "🔒", color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleMedium)
                        Text(if (unlocked) "★".repeat(stars) + "☆".repeat(3 - stars) else "Locked", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}
