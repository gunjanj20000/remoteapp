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
import kotlinx.coroutines.*
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.util.concurrent.atomic.AtomicLong

/**
 * Xiaomi Native MiLink Protocol Implementation (TCP Port 6091)
 * Used by official Xiaomi Mi TV remote apps without any pairing required.
 */
object MiLinkClient {
    const val MILINK_PORT = 6091
    const val FRAME_HEARTBEAT = 2
    const val FRAME_KEY = 4
    const val ACTION_DOWN = 0
    const val ACTION_UP = 1

    private val packetIdCounter = AtomicLong(100)

    private fun u16(v: Int): ByteArray = byteArrayOf(
        ((v ushr 8) and 0xff).toByte(),
        (v and 0xff).toByte()
    )

    private fun u32(v: Long): ByteArray = byteArrayOf(
        ((v ushr 24) and 0xff).toByte(),
        ((v ushr 16) and 0xff).toByte(),
        ((v ushr 8) and 0xff).toByte(),
        (v and 0xff).toByte()
    )

    private fun tlvI32(tag: Int, v: Int): ByteArray {
        val b = ByteArray(5)
        b[0] = tag.toByte()
        b[1] = ((v ushr 24) and 0xff).toByte()
        b[2] = ((v ushr 16) and 0xff).toByte()
        b[3] = ((v ushr 8) and 0xff).toByte()
        b[4] = (v and 0xff).toByte()
        return b
    }

    private fun tlvI64(tag: Int, v: Long): ByteArray {
        val b = ByteArray(9)
        b[0] = tag.toByte()
        val high = if (v < 0) 0xffffffffL else 0L
        b[1] = ((high ushr 24) and 0xff).toByte()
        b[2] = ((high ushr 16) and 0xff).toByte()
        b[3] = ((high ushr 8) and 0xff).toByte()
        b[4] = (high and 0xff).toByte()
        b[5] = ((v ushr 24) and 0xff).toByte()
        b[6] = ((v ushr 16) and 0xff).toByte()
        b[7] = ((v ushr 8) and 0xff).toByte()
        b[8] = (v and 0xff).toByte()
        return b
    }

    private fun buildKeyData(code: Int, action: Int): ByteArray {
        val bos = ByteArrayOutputStream()
        bos.write(tlvI32(1, 0)) // metaState
        bos.write(tlvI32(2, action)) // 0=DOWN, 1=UP
        bos.write(tlvI32(3, code)) // android keyCode
        bos.write(tlvI32(4, 0)) // scanCode
        bos.write(tlvI32(5, 0)) // repeatCount
        bos.write(tlvI32(6, 0)) // flags
        bos.write(tlvI64(7, 0)) // downTime: 0
        bos.write(tlvI64(8, 0)) // eventTime: 0
        bos.write(tlvI32(10, -1)) // deviceId: -1 (VIRTUAL_KEYBOARD)
        bos.write(tlvI32(11, 0x101)) // source: 0x101 (SOURCE_KEYBOARD)
        return bos.toByteArray()
    }

    private fun buildKeyFrame(id: Long, code: Int, action: Int): ByteArray {
        val data = buildKeyData(code, action)
        val body = ByteArrayOutputStream()
        body.write(1) // code 1 = send key command
        body.write(u32(id))
        body.write(u16(data.size))
        body.write(data)
        val bodyBytes = body.toByteArray()

        val frame = ByteArrayOutputStream()
        frame.write(FRAME_KEY) // type 4
        frame.write(u16(bodyBytes.size))
        frame.write(bodyBytes)
        return frame.toByteArray()
    }

    /**
     * Send a single key press (DOWN + UP) over TCP to port 6091
     */
    fun sendKeyPress(ip: String, keyCode: Int, timeoutMs: Int = 1200): Boolean {
        var socket: Socket? = null
        return try {
            socket = Socket()
            socket.connect(InetSocketAddress(ip, MILINK_PORT), timeoutMs)
            socket.soTimeout = timeoutMs
            val out = socket.getOutputStream()

            // 1. Send ACTION_DOWN
            val idDown = packetIdCounter.incrementAndGet()
            out.write(buildKeyFrame(idDown, keyCode, ACTION_DOWN))
            out.flush()

            Thread.sleep(35)

            // 2. Send ACTION_UP
            val idUp = packetIdCounter.incrementAndGet()
            out.write(buildKeyFrame(idUp, keyCode, ACTION_UP))
            out.flush()

            true
        } catch (_: Exception) {
            false
        } finally {
            try { socket?.close() } catch (_: Exception) {}
        }
    }
}

/**
 * DIAL (Discovery and Launch) Protocol Implementation (Port 8008)
 * Supported by all Smart TVs with Chromecast built-in for launching apps directly.
 */
object DialClient {
    fun launchApp(ip: String, dialAppName: String): Boolean {
        return try {
            val url = URL("http://$ip:8008/apps/$dialAppName")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 1500
            conn.readTimeout = 1500
            conn.doOutput = true
            conn.outputStream.close()
            val code = conn.responseCode
            conn.disconnect()
            code in 200..299 || code == 303
        } catch (_: Exception) {
            false
        }
    }
}

/**
 * Direct ADB Socket Client (TCP Port 5555)
 * Communicates with Android TV adbd daemon when "MiTV Adb debugging" is enabled.
 */
object AdbSocketClient {
    fun sendKeyEvent(ip: String, keyCode: Int, timeoutMs: Int = 1000): Boolean {
        var socket: Socket? = null
        return try {
            socket = Socket()
            socket.connect(InetSocketAddress(ip, 5555), timeoutMs)
            socket.soTimeout = timeoutMs
            val out = socket.getOutputStream()
            val cmd = "shell:input keyevent $keyCode"
            val hexLen = String.format("%04X", cmd.length)
            val packet = (hexLen + cmd).toByteArray(Charsets.UTF_8)
            out.write(packet)
            out.flush()
            true
        } catch (_: Exception) {
            false
        } finally {
            try { socket?.close() } catch (_: Exception) {}
        }
    }

    fun launchApp(ip: String, packageName: String, activity: String, timeoutMs: Int = 1200): Boolean {
        var socket: Socket? = null
        return try {
            socket = Socket()
            socket.connect(InetSocketAddress(ip, 5555), timeoutMs)
            socket.soTimeout = timeoutMs
            val out = socket.getOutputStream()
            val cmd = "shell:am start -n $packageName/$activity"
            val hexLen = String.format("%04X", cmd.length)
            val packet = (hexLen + cmd).toByteArray(Charsets.UTF_8)
            out.write(packet)
            out.flush()
            true
        } catch (_: Exception) {
            false
        } finally {
            try { socket?.close() } catch (_: Exception) {}
        }
    }
}

// Android Keycodes
object TVKeyCodes {
    const val POWER = 26
    const val UP = 19
    const val DOWN = 20
    const val LEFT = 21
    const val RIGHT = 22
    const val OK = 23
    const val BACK = 4
    const val HOME = 3
    const val MENU = 82
    const val VOLUME_UP = 24
    const val VOLUME_DOWN = 25
    const val MUTE = 164
    const val PLAY_PAUSE = 85
    const val REWIND = 89
    const val FAST_FORWARD = 90
    const val CHANNEL_UP = 166
    const val CHANNEL_DOWN = 167
    const val TV_INPUT = 178
    const val SETTINGS = 176
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    modifier: Modifier = Modifier,
    onItemClick: ((NavKey) -> Unit)? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var tvIp by remember { mutableStateOf("192.168.1.100") }
    var isConnected by remember { mutableStateOf(false) }
    var connectionMethod by remember { mutableStateOf("Not Tested") }
    var latencyMs by remember { mutableStateOf<Long?>(null) }
    var lastActionStatus by remember { mutableStateOf("Ready. Enter TV IP and connect.") }
    var volume by remember { mutableStateOf(35) }
    var isMuted by remember { mutableStateOf(false) }
    var isPowerOn by remember { mutableStateOf(true) }
    var activeApp by remember { mutableStateOf("Home") }
    
    var showSettingsDialog by remember { mutableStateOf(false) }
    var showDiagDialog by remember { mutableStateOf(false) }
    var diagResults by remember { mutableStateOf<List<String>>(emptyList()) }
    var isDiagnosing by remember { mutableStateOf(false) }

    fun triggerHaptic() {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        vibrator?.let {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                it.vibrate(VibrationEffect.createOneShot(18, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                it.vibrate(18)
            }
        }
    }

    // Comprehensive port testing & connection check
    fun checkAndConnect(ip: String) {
        val cleanIp = ip.trim()
        if (cleanIp.isEmpty()) return

        lastActionStatus = "Testing connection to $cleanIp..."
        coroutineScope.launch(Dispatchers.IO) {
            val start = System.currentTimeMillis()
            var connected = false
            var method = "None"

            // 1. Check MiLink (TCP 6091) - Native Xiaomi Remote protocol
            val hasMiLink = try {
                Socket().use { s ->
                    s.connect(InetSocketAddress(cleanIp, 6091), 800)
                    true
                }
            } catch (_: Exception) { false }

            // 2. Check DIAL (HTTP 8008) - Chromecast / App Launcher
            val hasDial = if (!hasMiLink) {
                try {
                    Socket().use { s ->
                        s.connect(InetSocketAddress(cleanIp, 8008), 800)
                        true
                    }
                } catch (_: Exception) { false }
            } else true

            // 3. Check ADB (TCP 5555)
            val hasAdb = if (!hasMiLink && !hasDial) {
                try {
                    Socket().use { s ->
                        s.connect(InetSocketAddress(cleanIp, 5555), 800)
                        true
                    }
                } catch (_: Exception) { false }
            } else false

            // 4. Check Legacy MiTV HTTP (Port 6095)
            val hasLegacyHttp = if (!hasMiLink && !hasDial && !hasAdb) {
                try {
                    Socket().use { s ->
                        s.connect(InetSocketAddress(cleanIp, 6095), 800)
                        true
                    }
                } catch (_: Exception) { false }
            } else false

            val elapsed = System.currentTimeMillis() - start

            if (hasMiLink) {
                connected = true
                method = "MiLink (Native Port 6091)"
            } else if (hasDial) {
                connected = true
                method = "DIAL App Launcher (Port 8008)"
            } else if (hasAdb) {
                connected = true
                method = "ADB over Network (Port 5555)"
            } else if (hasLegacyHttp) {
                connected = true
                method = "MiTV HTTP (Port 6095)"
            } else {
                connected = false
                method = "TV Unreachable on Network"
            }

            withContext(Dispatchers.Main) {
                isConnected = connected
                connectionMethod = method
                latencyMs = if (connected) elapsed else null
                lastActionStatus = if (connected) {
                    "Connected to $cleanIp via $method (${elapsed}ms)"
                } else {
                    "Cannot reach $cleanIp. Check IP and Wi-Fi/Ethernet."
                }
            }
        }
    }

    // Run deep network diagnostics on TV IP
    fun runDiagnostics(ip: String) {
        val cleanIp = ip.trim()
        isDiagnosing = true
        diagResults = listOf("Running diagnostics on $cleanIp...")
        showDiagDialog = true

        coroutineScope.launch(Dispatchers.IO) {
            val results = mutableListOf<String>()

            // 1. Ping
            val isReachable = try {
                java.net.InetAddress.getByName(cleanIp).isReachable(1500)
            } catch (_: Exception) { false }
            results.add("ICMP Ping: ${if (isReachable) "REACHABLE ✅" else "NO PING RESPONSE (may be blocked by router)"}")

            // 2. MiLink 6091
            val p6091 = try {
                Socket().use { s -> s.connect(InetSocketAddress(cleanIp, 6091), 1000); true }
            } catch (_: Exception) { false }
            results.add("Port 6091 (Xiaomi MiLink): ${if (p6091) "OPEN ✅ (Native remote control active)" else "CLOSED ❌"}")

            // 3. DIAL 8008
            val p8008 = try {
                Socket().use { s -> s.connect(InetSocketAddress(cleanIp, 8008), 1000); true }
            } catch (_: Exception) { false }
            results.add("Port 8008 (DIAL Smart TV): ${if (p8008) "OPEN ✅ (Direct app launching active)" else "CLOSED ❌"}")

            // 4. ADB 5555
            val p5555 = try {
                Socket().use { s -> s.connect(InetSocketAddress(cleanIp, 5555), 1000); true }
            } catch (_: Exception) { false }
            results.add("Port 5555 (ADB Debugging): ${if (p5555) "OPEN ✅ (Network debugging enabled)" else "CLOSED ❌ (Enable Developer Options -> Network Debugging)"}")

            // 5. Google TV Remote 6466
            val p6466 = try {
                Socket().use { s -> s.connect(InetSocketAddress(cleanIp, 6466), 1000); true }
            } catch (_: Exception) { false }
            results.add("Port 6466 (Google TV Remote): ${if (p6466) "OPEN ✅" else "CLOSED ❌"}")

            withContext(Dispatchers.Main) {
                diagResults = results
                isDiagnosing = false
            }
        }
    }

    // Send command to TV via MiLink, ADB socket or Fallback HTTP
    fun sendCommand(cmdName: String, keyCode: Int) {
        triggerHaptic()
        val currentIp = tvIp.trim()

        coroutineScope.launch(Dispatchers.IO) {
            var sent = MiLinkClient.sendKeyPress(currentIp, keyCode)
            var via = "MiLink (6091)"

            // 2. Try ADB socket (Port 5555)
            if (!sent) {
                sent = AdbSocketClient.sendKeyEvent(currentIp, keyCode)
                if (sent) via = "ADB (5555)"
            }

            // 3. Fallback: Xiaomi HTTP port 6095
            if (!sent) {
                try {
                    val url = URL("http://$currentIp:6095/controller?action=keyevent&keycode=${cmdName.lowercase()}")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.connectTimeout = 600
                    conn.readTimeout = 600
                    sent = conn.responseCode in 200..299
                    conn.disconnect()
                    if (sent) via = "MiTV HTTP (6095)"
                } catch (_: Exception) {}
            }

            withContext(Dispatchers.Main) {
                if (sent) {
                    lastActionStatus = "Sent $cmdName via $via ✅"
                } else {
                    lastActionStatus = "Command $cmdName failed. Check if TV is ON at $currentIp."
                }
            }
        }

        // Optimistic UI updates
        when (keyCode) {
            TVKeyCodes.VOLUME_UP -> { volume = (volume + 5).coerceAtMost(100); isMuted = false }
            TVKeyCodes.VOLUME_DOWN -> { volume = (volume - 5).coerceAtLeast(0); isMuted = false }
            TVKeyCodes.MUTE -> isMuted = !isMuted
            TVKeyCodes.POWER -> isPowerOn = !isPowerOn
        }
    }

    // Launch direct shortcut (YouTube, Netflix, Sony LIV, Prime Video)
    fun launchShortcut(appName: String, dialName: String?, packageName: String) {
        triggerHaptic()
        activeApp = appName
        val currentIp = tvIp.trim()
        lastActionStatus = "Launching $appName on TV..."
        Toast.makeText(context, "Opening $appName on $currentIp...", Toast.LENGTH_SHORT).show()

        coroutineScope.launch(Dispatchers.IO) {
            var launched = false
            var via = "DIAL (8008)"

            // 1. Try DIAL protocol (port 8008) - Supported by YouTube, Netflix, Prime Video
            if (dialName != null) {
                launched = DialClient.launchApp(currentIp, dialName)
            }

            // 2. Try ADB am start (port 5555)
            if (!launched) {
                launched = AdbSocketClient.launchApp(currentIp, packageName, ".MainActivity")
                if (launched) via = "ADB (5555)"
            }

            // 3. Try Xiaomi HTTP startapp (port 6095)
            if (!launched) {
                try {
                    val url = URL("http://$currentIp:6095/controller?action=startapp&packagename=$packageName")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.connectTimeout = 800
                    conn.readTimeout = 800
                    launched = conn.responseCode in 200..299
                    conn.disconnect()
                    if (launched) via = "MiTV HTTP (6095)"
                } catch (_: Exception) {}
            }

            withContext(Dispatchers.Main) {
                lastActionStatus = if (launched) {
                    "Launched $appName on TV via $via! ✅"
                } else {
                    "Dispatched $appName launch to $currentIp"
                }
            }
        }
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
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { showSettingsDialog = true }
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Brush.linearGradient(listOf(Color(0xFFFF6900), Color(0xFFE05300)))),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("mi", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("Xiaomi TV Remote", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(if (isConnected) Color(0xFF10B981) else Color(0xFFEF4444))
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = if (isConnected) "$tvIp • $connectionMethod" else "$tvIp (Tap to Setup)",
                                color = if (isConnected) Color(0xFF10B981) else Color(0xFF9CA3AF),
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { runDiagnostics(tvIp) }) {
                        Text("🔍", fontSize = 16.sp)
                    }
                    IconButton(onClick = { showSettingsDialog = true }) {
                        Text("⚙", color = Color(0xFF9CA3AF), fontSize = 18.sp)
                    }
                    IconButton(
                        onClick = { sendCommand("POWER", TVKeyCodes.POWER) },
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(if (isPowerOn) Color(0x33EF4444) else Color(0xFF272A34))
                    ) {
                        Text("⏻", color = Color(0xFFEF4444), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Status Bar Notification
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(if (isConnected) Color(0x1A10B981) else Color(0x1AEF4444))
                    .padding(horizontal = 16.dp, vertical = 6.dp)
            ) {
                Text(
                    text = lastActionStatus,
                    color = if (isConnected) Color(0xFF6EE7B7) else Color(0xFFFCA5A5),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // -------------------------------------------------------------
            // Direct App Shortcuts (YouTube, Netflix, Sony LIV, Prime Video)
            // -------------------------------------------------------------
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "DIRECT APP SHORTCUTS",
                        color = Color(0xFF9CA3AF),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "Instant Launch",
                        color = Color(0xFFFF6900),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // 1. YouTube
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { launchShortcut("YouTube", "YouTube", "com.google.android.youtube.tv") },
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
                                Text("DIAL Launch", color = Color(0xFF9CA3AF), fontSize = 10.sp)
                            }
                        }
                    }

                    // 2. Netflix
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { launchShortcut("Netflix", "Netflix", "com.netflix.ninja") },
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
                                Text("DIAL Launch", color = Color(0xFF9CA3AF), fontSize = 10.sp)
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
                            .clickable { launchShortcut("Sony LIV", "SonyLIV", "com.sonyliv") },
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
                                Text("Live Stream", color = Color(0xFF9CA3AF), fontSize = 10.sp)
                            }
                        }
                    }

                    // 4. Prime Video
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { launchShortcut("Prime Video", "AmazonInstantVideo", "com.amazon.amazonvideo.livingroom") },
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
                                Text("DIAL Launch", color = Color(0xFF9CA3AF), fontSize = 10.sp)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

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
                    onClick = { sendCommand("UP", TVKeyCodes.UP) },
                    modifier = Modifier.align(Alignment.TopCenter).padding(top = 8.dp)
                ) {
                    Text("▲", color = Color.White, fontSize = 22.sp)
                }

                // DOWN
                IconButton(
                    onClick = { sendCommand("DOWN", TVKeyCodes.DOWN) },
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 8.dp)
                ) {
                    Text("▼", color = Color.White, fontSize = 22.sp)
                }

                // LEFT
                IconButton(
                    onClick = { sendCommand("LEFT", TVKeyCodes.LEFT) },
                    modifier = Modifier.align(Alignment.CenterStart).padding(start = 8.dp)
                ) {
                    Text("◀", color = Color.White, fontSize = 22.sp)
                }

                // RIGHT
                IconButton(
                    onClick = { sendCommand("RIGHT", TVKeyCodes.RIGHT) },
                    modifier = Modifier.align(Alignment.CenterEnd).padding(end = 8.dp)
                ) {
                    Text("▶", color = Color.White, fontSize = 22.sp)
                }

                // Center OK Button
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(Brush.verticalGradient(listOf(Color(0xFF2E3340), Color(0xFF1C1F26))))
                        .border(1.dp, Color(0xFF4B5563), CircleShape)
                        .clickable { sendCommand("OK", TVKeyCodes.OK) },
                    contentAlignment = Alignment.Center
                ) {
                    Text("OK", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

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
                    onClick = { sendCommand("BACK", TVKeyCodes.BACK) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1D24)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.weight(1f).height(50.dp)
                ) {
                    Text("◀ Back", color = Color(0xFFD1D5DB), fontWeight = FontWeight.Medium, fontSize = 12.sp)
                }

                Spacer(modifier = Modifier.width(12.dp))

                Button(
                    onClick = { sendCommand("HOME", TVKeyCodes.HOME) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1D24)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.weight(1f).height(50.dp)
                ) {
                    Text("🏠 Home", color = Color(0xFFFF6900), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }

                Spacer(modifier = Modifier.width(12.dp))

                Button(
                    onClick = { sendCommand("MENU", TVKeyCodes.MENU) },
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
                    IconButton(onClick = { sendCommand("VOLUME_UP", TVKeyCodes.VOLUME_UP) }) {
                        Text("+", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    }
                    IconButton(onClick = { sendCommand("MUTE", TVKeyCodes.MUTE) }) {
                        Text(if (isMuted) "🔇" else "🔊", fontSize = 16.sp)
                    }
                    IconButton(onClick = { sendCommand("VOLUME_DOWN", TVKeyCodes.VOLUME_DOWN) }) {
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
                    IconButton(onClick = { sendCommand("CHANNEL_UP", TVKeyCodes.CHANNEL_UP) }) {
                        Text("▲", color = Color.White, fontSize = 18.sp)
                    }
                    IconButton(onClick = { sendCommand("INPUT", TVKeyCodes.TV_INPUT) }) {
                        Text("📺", fontSize = 16.sp)
                    }
                    IconButton(onClick = { sendCommand("CHANNEL_DOWN", TVKeyCodes.CHANNEL_DOWN) }) {
                        Text("▼", color = Color.White, fontSize = 18.sp)
                    }
                    Text("CH", color = Color(0xFF6B7280), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Diagnostic button
            Button(
                onClick = { runDiagnostics(tvIp) },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF272A34)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.padding(horizontal = 24.dp).fillMaxWidth()
            ) {
                Text("🔍 Test TV Connection & Open Ports", fontSize = 12.sp, color = Color(0xFFFF6900))
            }

            Spacer(modifier = Modifier.height(24.dp))
        }

        // Settings Dialog
        if (showSettingsDialog) {
            AlertDialog(
                onDismissRequest = { showSettingsDialog = false },
                title = { Text("Xiaomi TV IP Setup") },
                text = {
                    Column {
                        Text(
                            "Enter the IP address of your Xiaomi TV (shown on TV under Settings → Network & Internet → Ethernet / Wi-Fi):",
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedTextField(
                            value = tvIp,
                            onValueChange = { tvIp = it },
                            label = { Text("TV IP (e.g. 192.168.1.45)") },
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

        // Network Diagnostics Dialog
        if (showDiagDialog) {
            AlertDialog(
                onDismissRequest = { showDiagDialog = false },
                title = { Text("TV Connection Diagnostics ($tvIp)") },
                text = {
                    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                        if (isDiagnosing) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Probing ports...", fontSize = 12.sp)
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        diagResults.forEach { r ->
                            Text(r, fontSize = 11.sp, color = if (r.contains("OPEN")) Color(0xFF10B981) else Color.White)
                            Spacer(modifier = Modifier.height(4.dp))
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = { showDiagDialog = false }) {
                        Text("Done")
                    }
                }
            )
        }
    }
}
