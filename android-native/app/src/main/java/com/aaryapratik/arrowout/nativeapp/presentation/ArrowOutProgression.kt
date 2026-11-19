package com.aaryapratik.arrowout.nativeapp.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aaryapratik.arrowout.nativeapp.domain.model.ArrowGameState

data class ArrowAchievement(
    val id: String,
    val title: String,
    val description: String,
    val unlocked: Boolean,
    val progress: String
)

data class ArrowSkin(val id: String, val title: String, val cost: Int, val colors: List<Int>)

internal object ArrowSkinCatalog {
    val all = listOf(
        ArrowSkin("classic", "Classic", 0, ArrowColorPalette.standardArgb),
        ArrowSkin("aurora", "Aurora", 75, listOf(0xFF00B4D8.toInt(),0xFF48CAE4.toInt(),0xFF90E0EF.toInt(),0xFF0077B6.toInt(),0xFF80FFDB.toInt(),0xFF64DFDF.toInt(),0xFF5390D9.toInt(),0xFF6930C3.toInt())),
        ArrowSkin("ember", "Ember", 120, listOf(0xFFFF6B35.toInt(),0xFFFF9F1C.toInt(),0xFFE71D36.toInt(),0xFFFFD166.toInt(),0xFF9D4EDD.toInt(),0xFFC77DFF.toInt(),0xFFFF7B00.toInt(),0xFFB5179E.toInt()))
    )
    fun byId(id: String): ArrowSkin = all.firstOrNull { it.id == id } ?: all.first()
}

internal object ArrowOutProgression {
    fun achievements(state: ArrowGameState): List<ArrowAchievement> {
        val cleared = state.bestStars.count { it.value > 0 }
        return listOf(
            ArrowAchievement("first_clear","First Flight","Clear your first campaign level",cleared >= 1,"$cleared / 1"),
            ArrowAchievement("ten_clears","Pathfinder","Clear 10 campaign levels",cleared >= 10,"$cleared / 10"),
            ArrowAchievement("world_one","Meadow Guardian","Unlock the Tidecaller Coast",state.unlockedLevel >= 126,"Level ${state.unlockedLevel} / 126"),
            ArrowAchievement("streak_three","Daily Habit","Reach a 3-day daily challenge streak",state.dailyBest >= 3,"Best streak ${state.dailyBest} / 3"),
            ArrowAchievement("streak_seven","Week of Arrows","Reach a 7-day daily challenge streak",state.dailyBest >= 7,"Best streak ${state.dailyBest} / 7"),
            ArrowAchievement("coin_hoarder","Coin Keeper","Collect 100 coins",state.coins >= 100,"${state.coins} / 100")
        )
    }

    fun purchase(state: ArrowGameState, skinId: String): ArrowGameState {
        val skin = ArrowSkinCatalog.all.firstOrNull { it.id == skinId } ?: return state
        if (skinId in state.unlockedArrowSkins) return state.copy(selectedArrowSkin = skinId)
        if (state.coins < skin.cost) return state.copy(message = "You need ${skin.cost - state.coins} more coins for ${skin.title}")
        return state.copy(
            coins = state.coins - skin.cost,
            unlockedArrowSkins = (state.unlockedArrowSkins + skinId).distinct(),
            selectedArrowSkin = skinId,
            message = "${skin.title} arrows unlocked!"
        )
    }

    fun select(state: ArrowGameState, skinId: String): ArrowGameState {
        if (skinId !in state.unlockedArrowSkins || ArrowSkinCatalog.all.none { it.id == skinId }) return state
        return state.copy(selectedArrowSkin = skinId, message = "${ArrowSkinCatalog.byId(skinId).title} arrows equipped")
    }
}

@Composable
internal fun ArrowOutProgressionPanel(
    state: ArrowGameState,
    onPurchaseSkin: (String) -> Unit,
    onSelectSkin: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("PLAYER PROGRESS", style = MaterialTheme.typography.titleMedium)
                Text("${state.bestStars.count { it.value > 0 }} levels cleared · ${state.bestStars.values.sum()} stars · ${state.coins} coins")
                Text("Daily streak: ${state.dailyStreak} days · best: ${state.dailyBest} days")
                ArrowOutProgression.achievements(state).forEach { achievement ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f)) {
                            Text(if (achievement.unlocked) "✓ ${achievement.title}" else achievement.title, style = MaterialTheme.typography.labelLarge)
                            Text(achievement.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(if (achievement.unlocked) "Unlocked" else achievement.progress, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("ARROW SKIN SHOP", style = MaterialTheme.typography.titleMedium)
                Text("Unlock cosmetic arrow palettes with coins earned in puzzles. No gameplay advantage.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                ArrowSkinCatalog.all.forEach { skin ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f)) {
                            Text(skin.title, style = MaterialTheme.typography.titleSmall)
                            Text(if (skin.id in state.unlockedArrowSkins) "Owned" else "${skin.cost} coins", style = MaterialTheme.typography.bodySmall)
                        }
                        if (state.selectedArrowSkin == skin.id) {
                            Text("Equipped", style = MaterialTheme.typography.labelLarge)
                        } else if (skin.id in state.unlockedArrowSkins) {
                            TextButton(onClick = { onSelectSkin(skin.id) }) { Text("Equip") }
                        } else {
                            Button(onClick = { onPurchaseSkin(skin.id) }, enabled = state.coins >= skin.cost) { Text("Unlock") }
                        }
                    }
                }
            }
        }
    }
}
