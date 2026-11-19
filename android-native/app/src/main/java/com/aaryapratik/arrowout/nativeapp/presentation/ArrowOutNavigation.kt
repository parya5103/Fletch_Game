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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.saveable.rememberSaveable
import com.aaryapratik.arrowout.nativeapp.domain.model.ArrowGameState

internal data class ArrowOutWorld(
    val id: Int,
    val title: String,
    val subtitle: String,
    val guardian: String,
    val biome: String,
    val firstLevel: Int,
    val lastLevel: Int,
    val story: String,
    val storyActs: List<String>
) {
    val rangeLabel: String get() = "Levels $firstLevel–$lastLevel"
}

internal object ArrowOutWorldCatalog {
    val worlds = listOf(
        ArrowOutWorld(1, "Whisperwind Meadow", "Sunlit glades and whispering waystones", "Lyra · the Songkeeper", "Meadow", 1, 125, "Restore the meadow's lost song by freeing each winding arrow.", listOf("A wrong wind scattered every arrow of the meadow, and the songs that kept the paths open fell silent. Lyra, the Songkeeper, hid the last true note inside a fletching made of leaf and light.","She asks you to walk the winding green and free each arrow in the old order — the one the wind undid. Every path you clear returns one note to the meadow’s quiet song.","When the last arrow flies, Lyra lifts her head and sings the meadow awake. ‘The song remembers you, fletcher,’ she says. ‘Carry it east.’")),
        ArrowOutWorld(2, "Tidecaller Coast", "The living tide and its quiet coves", "Orin · of the Living Tide", "Coast", 126, 250, "Unblock the old channels and let the coast breathe again.", listOf("The tide at Orin’s coast stops mid-wave, frozen by a storm that lost its way inland. Orin, keeper of the living tide, cannot sing the water forward while arrows clog the old channels.","He lends you his patience: move only what the water would allow, one clean path at a time. The tide marks each arrow you free with a ring of light.","The wave Orin held finally falls, and the coast breathes again. ‘The tide now knows your hands,’ Orin says. ‘Kaelen waits where the sea meets trees.’")),
        ArrowOutWorld(3, "Stormveil Woods", "A forest caught inside a looping storm", "Kaelen · the Verdant Warden", "Forest", 251, 375, "Unwind the crooked paths and release the storm from the trees.", listOf("Lightning struck the heart of Stormveil and never left — it loops the same crooked trail through the branches. Kaelen guards a wood where every tree grew around an arrow overnight.","Kaelen gives you a simple rule: the forest frees only what stands in nothing’s way. Find the order the lightning wrote, and unwind it.","The looping storm follows its arrows out of the wood and fades over the sea. ‘Roots remember,’ Kaelen says. ‘Go up — Selene keeps the night.’")),
        ArrowOutWorld(4, "Moonlit Ruins", "Ancient stones beneath a waiting moon", "Selene · the Moonwarden", "Ruins", 376, 500, "Carefully unbind the moonlit ruins, one clear path at a time.", listOf("The moon over Selene’s ruins did not set, and the stones that drank its light grew restless. Selene sealed the ruins with moonlight so nothing wakes before its time.","Only careful hands may open her seal: arrows in the right order, no wrong pull, no rushed heart. Each cleared path dims one restless stone.","The ruins settle into honest shadow, and the moon finally moves. ‘You unbind gently,’ Selene says. ‘The sky fleet could use a fletcher.’")),
        ArrowOutWorld(5, "Zephyr Skies", "Cloudward fleets and open skies", "Captain Zephyr", "Sky", 501, 625, "Free the fleet's tangled ropes and send the ships back into the wind.", listOf("Captain Zephyr’s cloud fleet ran aground on a wind that refuses to blow. Arrows dropped from an old battle now pin each vessel’s rope to the sky itself.","The captain does not ask for bravery — only order. Cut the fleet loose arrow by arrow, the way a sailor reads a knot: from the outside in.","With a snap of canvas the fleet rides the first honest wind in years. ‘Fine hands, fletcher!’ Zephyr laughs. ‘Valkor’s mountains sit heavy on the horizon.’")),
        ArrowOutWorld(6, "Emberforge Peaks", "A sleeping forge beneath the mountains", "Valkor · the Forgemaster", "Volcanic", 626, 750, "Clear the forge vents and bring warmth back to the peaks.", listOf("Valkor’s forge cooled the night a thousand arrows jammed its chimneys, and the peaks above have been snowing ash ever since. The Forgemaster will not relight a forge he cannot clear.","He sets one rule in smoke and ember: free the paths that choke the vents, hottest first, and the forge will remember its fire.","The forge breathes orange again, and the ash turns back to clean snow. ‘Forged in order, cleared in order,’ Valkor rumbles. ‘Thalor has been waiting at the eclipse.’")),
        ArrowOutWorld(7, "Eclipse Sanctum", "A sanctuary held between light and shadow", "Archmage Thalor", "Eclipse", 751, 875, "Unbind the arches and let dawn return to the sanctum.", listOf("An eclipse over Thalor’s sanctum stuck halfway, and the light it trapped now binds every arch in the halls. The Archmage has kept his silence through a hundred years of half-day.","Thalor’s terms are exact: unbind each arch by the order of its making. Break the sequence, and the trapped light will simply wait for you to begin again.","The eclipse slides shut and open like an eye, and dawn arrives a century late. ‘Precisely done,’ Thalor says. ‘Astraea has watched you from the first arrow.’")),
        ArrowOutWorld(8, "Starfall Court", "A constellation waiting to fall into place", "Queen Astraea", "Cosmic", 876, 1000, "Untangle the stars and complete the fletcher's thousand-level journey.", listOf("Queen Astraea’s court of falling stars stalled mid-descent when its constellations tangled into knots of light. She has waited a thousand levels of dark for a fletcher with patient hands.","Her final ask is the oldest one: free every arrow in order, and let the stars fall true. The court counts each clear path as one star coming home.","The sky fills with falling light, and the court lands softly for the first time in an age. ‘The arrows are out,’ Queen Astraea says. ‘The story is yours now, fletcher.’"))
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

internal fun pendingGuardianWorld(unlockedLevel:Int,seenWorldIds:List<Int>):ArrowOutWorld? =
    ArrowOutWorldCatalog.worlds.firstOrNull { unlockedLevel >= it.firstLevel && it.id !in seenWorldIds }

@Composable
internal fun ArrowOutWorldMapScreen(
    state: ArrowGameState,
    onBack: () -> Unit,
    onWorldSelected: (Int) -> Unit,
    onStorySeen: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var storyAct by rememberSaveable(state.unlockedLevel,state.storySeenWorlds) { mutableIntStateOf(0) }
    val pendingStory = if (com.aaryapratik.arrowout.nativeapp.core.config.GameFeatureFlags.guardianStories) pendingGuardianWorld(state.unlockedLevel,state.storySeenWorlds) else null
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
    if(pendingStory!=null) AlertDialog(
        onDismissRequest={onStorySeen(pendingStory.id);storyAct=0},
        title={Text("${pendingStory.guardian} · ${pendingStory.title}")},
        text={
            Column(verticalArrangement=Arrangement.spacedBy(10.dp)){
                Text("GUARDIAN STORY · ACT ${storyAct+1} OF 3",style=MaterialTheme.typography.labelMedium,color=MaterialTheme.colorScheme.primary)
                Text(pendingStory.storyActs[storyAct],style=MaterialTheme.typography.bodyLarge)
            }
        },
        confirmButton={
            TextButton(onClick={
                if(storyAct<2)storyAct++ else {onStorySeen(pendingStory.id);storyAct=0}
            }){Text(if(storyAct<2)"Next" else "Begin adventure")}
        },
        dismissButton={TextButton(onClick={onStorySeen(pendingStory.id)}){Text("Skip story")}}
    )
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
