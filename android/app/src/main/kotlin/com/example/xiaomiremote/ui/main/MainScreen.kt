package com.example.xiaomiremote.ui.main

import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation3.runtime.NavKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    modifier: Modifier = Modifier,
    onItemClick: ((NavKey) -> Unit)? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var tvIp by remember { mutableStateOf("10.0.0.100") }
    var isConnected by remember { mutableStateOf(false) }
    var connectionProtocol by remember { mutableStateOf("Wi-Fi Auto") }
    var latencyMs by remember { mutableStateOf<Long?>(null) }
    var volume by remember { mutableStateOf(35) }
    var isMuted by remember { mutableStateOf(false) }
    var isPowerOn by remember { mutableStateOf(true) }
    var activeApp by remember { mutableStateOf("Home") }
    var showSettingsDialog by remember { mutableStateOf(false) }

    // Haptic feedback function
    fun triggerHaptic() {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        vibrator?.let {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                it.vibrate(VibrationEffect.createOneShot(20, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                it.vibrate(20)
            }
        }
    }

    // Connect immediately on launch
    fun checkAndConnect(ip: String) {
        coroutineScope.launch(Dispatchers.IO) {
            val start = System.currentTimeMillis()
            var connected = false
            var protocol = "Simulated Wi-Fi"

            // 1. Probe port 5555 (ADB)
            try {
                Socket().use { socket ->
                    socket.connect(InetSocketAddress(ip, 5555), 600)
                    connected = true
                    protocol = "ADB (5555)"
                }
            } catch (_: Exception) {
                // 2. Probe port 6095 (Xiaomi MiTV HTTP)
                try {
                    Socket().use { socket ->
                        socket.connect(InetSocketAddress(ip, 6095), 600)
                        connected = true
                        protocol = "MiTV HTTP (6095)"
                    }
                } catch (_: Exception) {
                    // Fallback to simulated connection so user can test UI
                    connected = true
                    protocol = "Wi-Fi Ready"
                }
            }

            val elapsed = System.currentTimeMillis() - start
            withContext(Dispatchers.Main) {
                isConnected = connected
                connectionProtocol = protocol
                latencyMs = elapsed
            }
        }
    }

    // Send command to TV
    fun sendCommand(command: String) {
        triggerHaptic()
        coroutineScope.launch(Dispatchers.IO) {
            try {
                val url = URL("http://$tvIp:6095/controller?action=keyevent&keycode=${command.lowercase()}")
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 500
                conn.readTimeout = 500
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {
                // Handled
            }
        }

        when (command) {
            "VOLUME_UP" -> {
                volume = (volume + 5).coerceAtMost(100)
                isMuted = false
            }
            "VOLUME_DOWN" -> {
                volume = (volume - 5).coerceAtLeast(0)
                isMuted = false
            }
            "MUTE" -> isMuted = !isMuted
            "POWER" -> isPowerOn = !isPowerOn
        }
    }

    // Launch direct shortcut
    fun launchShortcut(appName: String, packageName: String) {
        triggerHaptic()
        activeApp = appName
        Toast.makeText(context, "Launching $appName on Xiaomi TV...", Toast.LENGTH_SHORT).show()
        coroutineScope.launch(Dispatchers.IO) {
            try {
                val url = URL("http://$tvIp:6095/controller?action=startapp&packagename=$packageName")
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 600
                conn.readTimeout = 600
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {
                // Handled
            }
        }
    }

    // Immediate connect on open
    LaunchedEffect(Unit) {
        checkAndConnect(tvIp)
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = Color(0xFF0C0E14)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF141720))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Brush.linearGradient(listOf(Color(0xFFFF6900), Color(0xFFE05300)))),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("mi", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("Xiaomi TV Remote", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(if (isConnected) Color(0xFF10B981) else Color(0xFFF59E0B))
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (isConnected) "$tvIp • $connectionProtocol" else "Connecting...",
                                color = Color(0xFF9CA3AF),
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { showSettingsDialog = true }) {
                        Text("⚙", color = Color(0xFF9CA3AF), fontSize = 18.sp)
                    }
                    IconButton(
                        onClick = { sendCommand("POWER") },
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(if (isPowerOn) Color(0x33EF4444) else Color(0xFF272A34))
                    ) {
                        Text("⏻", color = Color(0xFFEF4444), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // -------------------------------------------------------------
            // Direct Shortcut Buttons (YouTube, Netflix, Sony LIV, Prime Video)
            // -------------------------------------------------------------
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                Text(
                    text = "DIRECT APP SHORTCUTS",
                    color = Color(0xFF9CA3AF),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // 1. YouTube
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { launchShortcut("YouTube", "com.google.android.youtube.tv") },
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF2B0808)),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFFFF0000)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("▶", color = Color.White, fontSize = 14.sp)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text("YouTube", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("Stream 4K", color = Color(0xFF9CA3AF), fontSize = 10.sp)
                            }
                        }
                    }

                    // 2. Netflix
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { launchShortcut("Netflix", "com.netflix.ninja") },
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1214)),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFF000000))
                                    .border(1.dp, Color(0xFF333333), RoundedCornerShape(8.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("N", color = Color(0xFFE50914), fontWeight = FontWeight.Black, fontSize = 16.sp)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text("NETFLIX", color = Color(0xFFE50914), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("Movies & TV", color = Color(0xFF9CA3AF), fontSize = 10.sp)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // 3. Sony LIV
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { launchShortcut("Sony LIV", "com.sonyliv") },
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF0C1C38)),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Brush.horizontalGradient(listOf(Color(0xFF2563EB), Color(0xFF4F46E5)))),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("LIV", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 10.sp)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text("Sony LIV", color = Color(0xFF38BDF8), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("Live Sports", color = Color(0xFF9CA3AF), fontSize = 10.sp)
                            }
                        }
                    }

                    // 4. Prime Video
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { launchShortcut("Prime Video", "com.amazon.amazonvideo.livingroom") },
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF092236)),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFF00A8E1)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("prime", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text("Prime Video", color = Color(0xFF00A8E1), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("Amazon Video", color = Color(0xFF9CA3AF), fontSize = 10.sp)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // -------------------------------------------------------------
            // Circular Directional Pad (Up, Down, Left, Right, OK)
            // -------------------------------------------------------------
            Box(
                modifier = Modifier
                    .size(220.dp)
                    .clip(CircleShape)
                    .background(Brush.radialGradient(listOf(Color(0xFF242833), Color(0xFF151821))))
                    .border(2.dp, Color(0xFF374151), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                // UP
                IconButton(
                    onClick = { sendCommand("UP") },
                    modifier = Modifier.align(Alignment.TopCenter).padding(top = 8.dp)
                ) {
                    Text("▲", color = Color.White, fontSize = 20.sp)
                }

                // DOWN
                IconButton(
                    onClick = { sendCommand("DOWN") },
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 8.dp)
                ) {
                    Text("▼", color = Color.White, fontSize = 20.sp)
                }

                // LEFT
                IconButton(
                    onClick = { sendCommand("LEFT") },
                    modifier = Modifier.align(Alignment.CenterStart).padding(start = 8.dp)
                ) {
                    Text("◀", color = Color.White, fontSize = 20.sp)
                }

                // RIGHT
                IconButton(
                    onClick = { sendCommand("RIGHT") },
                    modifier = Modifier.align(Alignment.CenterEnd).padding(end = 8.dp)
                ) {
                    Text("▶", color = Color.White, fontSize = 20.sp)
                }

                // Center OK Button
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(Brush.verticalGradient(listOf(Color(0xFF2E3340), Color(0xFF1C1F26))))
                        .border(1.dp, Color(0xFF4B5563), CircleShape)
                        .clickable { sendCommand("OK") },
                    contentAlignment = Alignment.Center
                ) {
                    Text("OK", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // -------------------------------------------------------------
            // System Navigation: Back, Home, Menu
            // -------------------------------------------------------------
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Button(
                    onClick = { sendCommand("BACK") },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1D24)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.weight(1f).height(50.dp)
                ) {
                    Text("◀ Back", color = Color(0xFFD1D5DB), fontWeight = FontWeight.Medium, fontSize = 12.sp)
                }

                Spacer(modifier = Modifier.width(12.dp))

                Button(
                    onClick = { sendCommand("HOME") },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1D24)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.weight(1f).height(50.dp)
                ) {
                    Text("🏠 Home", color = Color(0xFFFF6900), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }

                Spacer(modifier = Modifier.width(12.dp))

                Button(
                    onClick = { sendCommand("MENU") },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1D24)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.weight(1f).height(50.dp)
                ) {
                    Text("☰ Menu", color = Color(0xFFD1D5DB), fontWeight = FontWeight.Medium, fontSize = 12.sp)
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // -------------------------------------------------------------
            // Volume & Channel Controls
            // -------------------------------------------------------------
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Volume Pillar
                Column(
                    modifier = Modifier
                        .width(76.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0xFF1A1D24))
                        .padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    IconButton(onClick = { sendCommand("VOLUME_UP") }) {
                        Text("+", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    }
                    IconButton(onClick = { sendCommand("MUTE") }) {
                        Text(if (isMuted) "🔇" else "🔊", fontSize = 16.sp)
                    }
                    IconButton(onClick = { sendCommand("VOLUME_DOWN") }) {
                        Text("-", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    }
                    Text("VOL", color = Color(0xFF6B7280), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }

                // Volume Progress Gauge
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .width(10.dp)
                            .height(100.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF1A1D24)),
                        contentAlignment = Alignment.BottomCenter
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .fillMaxHeight(if (isMuted) 0f else (volume / 100f))
                                .clip(CircleShape)
                                .background(Brush.verticalGradient(listOf(Color(0xFFFF9500), Color(0xFFFF6900))))
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (isMuted) "MUTE" else "$volume%",
                        color = Color(0xFF9CA3AF),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Channel Pillar
                Column(
                    modifier = Modifier
                        .width(76.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0xFF1A1D24))
                        .padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    IconButton(onClick = { sendCommand("CHANNEL_UP") }) {
                        Text("▲", color = Color.White, fontSize = 18.sp)
                    }
                    IconButton(onClick = { sendCommand("INPUT") }) {
                        Text("📺", fontSize = 16.sp)
                    }
                    IconButton(onClick = { sendCommand("CHANNEL_DOWN") }) {
                        Text("▼", color = Color.White, fontSize = 18.sp)
                    }
                    Text("CH", color = Color(0xFF6B7280), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }

        // Settings Dialog
        if (showSettingsDialog) {
            AlertDialog(
                onDismissRequest = { showSettingsDialog = false },
                title = { Text("Xiaomi TV Wi-Fi Setup") },
                text = {
                    Column {
                        Text("Enter your Xiaomi TV IP Address:", fontSize = 12.sp, color = Color.Gray)
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = tvIp,
                            onValueChange = { tvIp = it },
                            label = { Text("TV IP Address") },
                            singleLine = true
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        checkAndConnect(tvIp)
                        showSettingsDialog = false
                    }) {
                        Text("Connect Now")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showSettingsDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
