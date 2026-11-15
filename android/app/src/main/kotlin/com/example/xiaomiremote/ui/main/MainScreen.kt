package com.example.xiaomiremote.ui.main

import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation3.runtime.NavKey
import kotlinx.coroutines.*
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.util.concurrent.atomic.AtomicLong

/**
 * Xiaomi Native MiLink Protocol Implementation (TCP Port 6091)
 * Used by official Xiaomi Mi TV remote apps without any pairing required.
 * Keeps persistent TCP connection open for ultra-low latency & rapid repeat key support.
 */
object MiLinkClient {
    const val MILINK_PORT = 6091
    const val FRAME_HEARTBEAT = 2
    const val FRAME_KEY = 4
    const val ACTION_DOWN = 0
    const val ACTION_UP = 1

    private val packetIdCounter = AtomicLong(100)
    private var cachedSocket: Socket? = null
    private var cachedIp: String? = null
    private val socketLock = Any()

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

    private fun getOrCreateSocket(ip: String, timeoutMs: Int): Socket? {
        val s = cachedSocket
        if (s != null && !s.isClosed && s.isConnected && cachedIp == ip) {
            return s
        }
        try { s?.close() } catch (_: Exception) {}
        cachedSocket = null
        return try {
            val newSock = Socket()
            newSock.tcpNoDelay = true
            newSock.connect(InetSocketAddress(ip, MILINK_PORT), timeoutMs)
            newSock.soTimeout = timeoutMs
            cachedSocket = newSock
            cachedIp = ip
            newSock
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Send keypress (DOWN + UP) with persistent TCP reuse.
     */
    fun sendKeyPress(ip: String, keyCode: Int, timeoutMs: Int = 1000): Boolean {
        synchronized(socketLock) {
            for (attempt in 0..1) {
                val socket = getOrCreateSocket(ip, timeoutMs) ?: return false
                try {
                    val out = socket.getOutputStream()

                    // 1. Send ACTION_DOWN
                    val idDown = packetIdCounter.incrementAndGet()
                    out.write(buildKeyFrame(idDown, keyCode, ACTION_DOWN))
                    out.flush()

                    Thread.sleep(25)

                    // 2. Send ACTION_UP
                    val idUp = packetIdCounter.incrementAndGet()
                    out.write(buildKeyFrame(idUp, keyCode, ACTION_UP))
                    out.flush()

                    return true
                } catch (_: Exception) {
                    try { socket.close() } catch (_: Exception) {}
                    cachedSocket = null
                    if (attempt == 1) return false
                }
            }
            return false
        }
    }
}

/**
 * Multi-strategy App Launcher (DIAL + Xiaomi MiLink OEM Keys + Port 6095)
 * Solves launching for YouTube, Netflix, Prime Video, Sony LIV.
 */
object AppShortcutLauncher {
    data class ShortcutTarget(
        val dialNames: List<String>,
        val origins: List<String>,
        val payload: String?,
        val keyCodes: List<Int>,
        val packageNames: List<String>
    )

    private val TARGETS = mapOf(
        "YouTube" to ShortcutTarget(
            dialNames = listOf("YouTube", "YouTubeTV", "YouTubeLeanback", "com.google.android.youtube.tv"),
            origins = listOf("https://www.youtube.com", "https://www.google.com"),
            payload = "v=",
            keyCodes = listOf(190, 289, 297), // 190=Xiaomi remote YouTube, 289=VIDEO_APP_1
            packageNames = listOf("com.google.android.youtube.tv")
        ),
        "Netflix" to ShortcutTarget(
            dialNames = listOf("Netflix"),
            origins = listOf("https://www.netflix.com"),
            payload = null,
            keyCodes = listOf(193), // 193=Xiaomi remote Netflix
            packageNames = listOf("com.netflix.ninja")
        ),
        "Prime Video" to ShortcutTarget(
            dialNames = listOf(
                "AmazonPrimeVideo",
                "PrimeVideo",
                "AmazonVideo",
                "AmazonInstantVideo",
                "com.amazon.amazonvideo.livingroom"
            ),
            origins = listOf("https://www.primevideo.com", "https://atv-ext.amazon.com"),
            payload = null,
            keyCodes = listOf(194, 290, 298), // 194=Xiaomi remote Prime Video, 290=VIDEO_APP_2
            packageNames = listOf(
                "com.amazon.amazonvideo.livingroom",
                "com.amazon.avod.thirdpartyclient"
            )
        ),
        "Sony LIV" to ShortcutTarget(
            dialNames = listOf(
                "SonyLIV",
                "SonyLiv",
                "sonyliv",
                "Sony_LIV",
                "com.sonyliv"
            ),
            origins = listOf("https://www.sonyliv.com", "package:com.sonyliv"),
            payload = null,
            keyCodes = listOf(195, 191, 291, 299), // 195=Xiaomi remote Button 8, 191=Button 4
            packageNames = listOf("com.sonyliv")
        )
    )

    fun launch(ip: String, appName: String): Pair<Boolean, String> {
        val target = TARGETS[appName] ?: return Pair(false, "Unknown shortcut")

        // 1. Try DIAL endpoints
        for (dialName in target.dialNames) {
            for (origin in target.origins) {
                if (tryDialPost(ip, dialName, origin, target.payload)) {
                    return Pair(true, "DIAL ($dialName)")
                }
            }
            if (tryDialPost(ip, dialName, null, target.payload)) {
                return Pair(true, "DIAL ($dialName)")
            }
        }

        // 2. Try Xiaomi Native MiLink OEM Keycodes
        for (code in target.keyCodes) {
            val ok = MiLinkClient.sendKeyPress(ip, code)
            if (ok) {
                return Pair(true, "MiLink Key ($code)")
            }
        }

        // 3. Try Xiaomi TV HTTP startapp (port 6095)
        for (pkg in target.packageNames) {
            try {
                val url = URL("http://$ip:6095/controller?action=startapp&packagename=$pkg")
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 600
                conn.readTimeout = 600
                val code = conn.responseCode
                conn.disconnect()
                if (code in 200..299) {
                    return Pair(true, "MiTV API ($pkg)")
                }
            } catch (_: Exception) {}
        }

        return Pair(false, "Sent launch signal to $ip")
    }

    private fun tryDialPost(ip: String, dialName: String, origin: String?, payload: String?): Boolean {
        return try {
            val url = URL("http://$ip:8008/apps/$dialName")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 900
            conn.readTimeout = 900
            conn.setRequestProperty("Content-Type", "text/plain; charset=utf-8")
            if (origin != null) {
                conn.setRequestProperty("Origin", origin)
            }
            conn.doOutput = true

            val body = (payload ?: "").toByteArray(Charsets.UTF_8)
            conn.setFixedLengthStreamingMode(body.size)
            conn.outputStream.use { it.write(body) }

            val code = conn.responseCode
            conn.disconnect()
            code in 200..299 || code == 303
        } catch (_: Exception) {
            false
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
    const val CHANNEL_UP = 166
    const val CHANNEL_DOWN = 167
    const val TV_INPUT = 178
    const val SETTINGS = 176
}

/**
 * Reusable Hold-to-Repeat Button component for Volume and Navigation.
 * Fires once immediately on touch, then repeats continuously while held.
 */
@Composable
fun RepeatingIconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    initialDelayMs: Long = 320L,
    repeatIntervalMs: Long = 90L,
    content: @Composable () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val currentOnClick by rememberUpdatedState(onClick)
    var isPressed by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(if (isPressed) Color(0x33FFFFFF) else Color.Transparent)
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = {
                        isPressed = true
                        currentOnClick() // Instant first trigger
                        val job = coroutineScope.launch {
                            delay(initialDelayMs)
                            while (isActive) {
                                currentOnClick()
                                delay(repeatIntervalMs)
                            }
                        }
                        try {
                            tryAwaitRelease()
                        } finally {
                            job.cancel()
                            isPressed = false
                        }
                    }
                )
            },
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    modifier: Modifier = Modifier,
    onItemClick: ((NavKey) -> Unit)? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

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

            // 2. Check DIAL (HTTP 8008) - Smart TV DIAL service
            val hasDial = if (!hasMiLink) {
                try {
                    Socket().use { s ->
                        s.connect(InetSocketAddress(cleanIp, 8008), 800)
                        true
                    }
                } catch (_: Exception) { false }
            } else true

            val elapsed = System.currentTimeMillis() - start

            if (hasMiLink) {
                connected = true
                method = "MiLink (Native Port 6091)"
            } else if (hasDial) {
                connected = true
                method = "DIAL Launcher (Port 8008)"
            } else {
                connected = false
                method = "Unreachable"
            }

            withContext(Dispatchers.Main) {
                isConnected = connected
                connectionMethod = method
                latencyMs = if (connected) elapsed else null
                lastActionStatus = if (connected) {
                    "Connected to $cleanIp via $method (${elapsed}ms) ✅"
                } else {
                    "Cannot reach $cleanIp. Check IP and Wi-Fi/Ethernet."
                }
            }
        }
    }

    // Deep network diagnostics on TV IP
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
            results.add("ICMP Ping: ${if (isReachable) "REACHABLE ✅" else "NO PING RESPONSE (normal on some routers)"}")

            // 2. MiLink 6091
            val p6091 = try {
                Socket().use { s -> s.connect(InetSocketAddress(cleanIp, 6091), 1000); true }
            } catch (_: Exception) { false }
            results.add("Port 6091 (Xiaomi MiLink): ${if (p6091) "OPEN ✅ (Full remote control active)" else "CLOSED ❌"}")

            // 3. DIAL 8008
            val p8008 = try {
                Socket().use { s -> s.connect(InetSocketAddress(cleanIp, 8008), 1000); true }
            } catch (_: Exception) { false }
            results.add("Port 8008 (DIAL Smart TV): ${if (p8008) "OPEN ✅ (Direct app launching active)" else "CLOSED ❌"}")

            // 4. ADB 5555
            val p5555 = try {
                Socket().use { s -> s.connect(InetSocketAddress(cleanIp, 5555), 1000); true }
            } catch (_: Exception) { false }
            results.add("Port 5555 (ADB): ${if (p5555) "OPEN ✅" else "CLOSED (Not needed for MiLink)"}")

            withContext(Dispatchers.Main) {
                diagResults = results
                isDiagnosing = false
            }
        }
    }

    // Send command to TV via persistent MiLink
    fun sendCommand(cmdName: String, keyCode: Int) {
        triggerHaptic()
        val currentIp = tvIp.trim()

        coroutineScope.launch(Dispatchers.IO) {
            val sent = MiLinkClient.sendKeyPress(currentIp, keyCode)

            withContext(Dispatchers.Main) {
                if (sent) {
                    lastActionStatus = "$cmdName ✅"
                } else {
                    lastActionStatus = "Command $cmdName failed. Check TV IP."
                }
            }
        }

        // Optimistic UI updates
        when (keyCode) {
            TVKeyCodes.VOLUME_UP -> { volume = (volume + 2).coerceAtMost(100); isMuted = false }
            TVKeyCodes.VOLUME_DOWN -> { volume = (volume - 2).coerceAtLeast(0); isMuted = false }
            TVKeyCodes.MUTE -> isMuted = !isMuted
            TVKeyCodes.POWER -> isPowerOn = !isPowerOn
        }
    }

    // Launch direct shortcut (YouTube, Netflix, Sony LIV, Prime Video)
    fun launchShortcut(appName: String) {
        triggerHaptic()
        activeApp = appName
        val currentIp = tvIp.trim()
        lastActionStatus = "Opening $appName on TV..."
        Toast.makeText(context, "Opening $appName on $currentIp...", Toast.LENGTH_SHORT).show()

        coroutineScope.launch(Dispatchers.IO) {
            val (success, method) = AppShortcutLauncher.launch(currentIp, appName)
            withContext(Dispatchers.Main) {
                lastActionStatus = if (success) {
                    "Launched $appName via $method ✅"
                } else {
                    "Dispatched $appName launch commands to $currentIp"
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
                .padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // -------------------------------------------------------------
            // 1. Header Bar
            // -------------------------------------------------------------
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFF141720))
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { showSettingsDialog = true }
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Brush.linearGradient(listOf(Color(0xFFFF6900), Color(0xFFE05300)))),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("mi", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("Xiaomi TV Remote", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(if (isConnected) Color(0xFF10B981) else Color(0xFFEF4444))
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = if (isConnected) "$tvIp • MiLink" else "$tvIp (Tap to Setup)",
                                color = if (isConnected) Color(0xFF10B981) else Color(0xFF9CA3AF),
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    IconButton(
                        onClick = { runDiagnostics(tvIp) },
                        modifier = Modifier.size(34.dp)
                    ) {
                        Text("🔍", fontSize = 14.sp)
                    }
                    IconButton(
                        onClick = { showSettingsDialog = true },
                        modifier = Modifier.size(34.dp)
                    ) {
                        Text("⚙", color = Color(0xFF9CA3AF), fontSize = 16.sp)
                    }
                    IconButton(
                        onClick = { sendCommand("POWER", TVKeyCodes.POWER) },
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(if (isPowerOn) Color(0x33EF4444) else Color(0xFF272A34))
                    ) {
                        Text("⏻", color = Color(0xFFEF4444), fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // -------------------------------------------------------------
            // 2. Slim Status Notification Strip
            // -------------------------------------------------------------
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (isConnected) Color(0x1A10B981) else Color(0x1AEF4444))
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                Text(
                    text = lastActionStatus,
                    color = if (isConnected) Color(0xFF6EE7B7) else Color(0xFFFCA5A5),
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontWeight = FontWeight.Medium
                )
            }

            // -------------------------------------------------------------
            // 3. Direct App Shortcuts (YouTube, Netflix, Sony LIV, Prime Video)
            // -------------------------------------------------------------
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // Row 1: YouTube & Netflix
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // YouTube
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .clickable { launchShortcut("YouTube") },
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF240A0A)),
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x44EF4444))
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(Color(0xFFFF0000)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("▶", color = Color.White, fontSize = 10.sp)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("YouTube", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }

                    // Netflix
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .clickable { launchShortcut("Netflix") },
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F0C0F)),
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x44E50914))
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text("NETFLIX", color = Color(0xFFE50914), fontWeight = FontWeight.Black, fontSize = 13.sp, letterSpacing = 1.sp)
                        }
                    }
                }

                // Row 2: Sony LIV & Prime Video
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Sony LIV
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .clickable { launchShortcut("Sony LIV") },
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF0D172E)),
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x443B82F6))
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(Brush.horizontalGradient(listOf(Color(0xFF2563EB), Color(0xFF7C3AED)))),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("LIV", color = Color.White, fontWeight = FontWeight.Black, fontSize = 8.sp)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Sony LIV", color = Color(0xFF60A5FA), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }

                    // Prime Video
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .clickable { launchShortcut("Prime Video") },
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF091C29)),
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x4400A8E1))
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text("prime video", color = Color(0xFF00A8E1), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }

            // -------------------------------------------------------------
            // 4. Circular Directional Pad (D-Pad)
            // -------------------------------------------------------------
            Box(
                modifier = Modifier
                    .size(165.dp)
                    .clip(CircleShape)
                    .background(Brush.radialGradient(listOf(Color(0xFF232733), Color(0xFF13151D))))
                    .border(2.dp, Color(0xFF374151), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                // UP
                IconButton(
                    onClick = { sendCommand("UP", TVKeyCodes.UP) },
                    modifier = Modifier.align(Alignment.TopCenter).padding(top = 4.dp).size(42.dp)
                ) {
                    Text("▲", color = Color.White, fontSize = 18.sp)
                }

                // DOWN
                IconButton(
                    onClick = { sendCommand("DOWN", TVKeyCodes.DOWN) },
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 4.dp).size(42.dp)
                ) {
                    Text("▼", color = Color.White, fontSize = 18.sp)
                }

                // LEFT
                IconButton(
                    onClick = { sendCommand("LEFT", TVKeyCodes.LEFT) },
                    modifier = Modifier.align(Alignment.CenterStart).padding(start = 4.dp).size(42.dp)
                ) {
                    Text("◀", color = Color.White, fontSize = 18.sp)
                }

                // RIGHT
                IconButton(
                    onClick = { sendCommand("RIGHT", TVKeyCodes.RIGHT) },
                    modifier = Modifier.align(Alignment.CenterEnd).padding(end = 4.dp).size(42.dp)
                ) {
                    Text("▶", color = Color.White, fontSize = 18.sp)
                }

                // Center OK Button
                Box(
                    modifier = Modifier
                        .size(62.dp)
                        .clip(CircleShape)
                        .background(Brush.verticalGradient(listOf(Color(0xFF2F3442), Color(0xFF1A1D25))))
                        .border(1.dp, Color(0xFF4B5563), CircleShape)
                        .clickable { sendCommand("OK", TVKeyCodes.OK) },
                    contentAlignment = Alignment.Center
                ) {
                    Text("OK", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }

            // -------------------------------------------------------------
            // 5. System Navigation (Back, Home, Menu)
            // -------------------------------------------------------------
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { sendCommand("BACK", TVKeyCodes.BACK) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1D24)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(38.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text("◀ Back", color = Color(0xFFD1D5DB), fontWeight = FontWeight.Medium, fontSize = 11.sp)
                }

                Button(
                    onClick = { sendCommand("HOME", TVKeyCodes.HOME) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1D24)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(38.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text("🏠 Home", color = Color(0xFFFF6900), fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }

                Button(
                    onClick = { sendCommand("MENU", TVKeyCodes.MENU) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1D24)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(38.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text("☰ Menu", color = Color(0xFFD1D5DB), fontWeight = FontWeight.Medium, fontSize = 11.sp)
                }
            }

            // -------------------------------------------------------------
            // 6. Volume & Channel Section with Hold-to-Repeat Volume
            // -------------------------------------------------------------
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Volume Pillar with HOLD-TO-REPEAT
                Column(
                    modifier = Modifier
                        .width(72.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFF1A1D24))
                        .padding(vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    RepeatingIconButton(
                        onClick = { sendCommand("VOLUME_UP", TVKeyCodes.VOLUME_UP) },
                        modifier = Modifier.size(38.dp)
                    ) {
                        Text("+", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    }

                    Text("VOL", color = Color(0xFF9CA3AF), fontSize = 10.sp, fontWeight = FontWeight.Bold)

                    RepeatingIconButton(
                        onClick = { sendCommand("VOLUME_DOWN", TVKeyCodes.VOLUME_DOWN) },
                        modifier = Modifier.size(38.dp)
                    ) {
                        Text("-", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    }
                }

                // Center Quick Controls (Mute, Volume %, TV Input)
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    IconButton(
                        onClick = { sendCommand("MUTE", TVKeyCodes.MUTE) },
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(if (isMuted) Color(0x33EF4444) else Color(0xFF1A1D24))
                    ) {
                        Text(if (isMuted) "🔇" else "🔊", fontSize = 16.sp)
                    }

                    Text(
                        text = if (isMuted) "MUTED" else "$volume%",
                        color = if (isMuted) Color(0xFFEF4444) else Color(0xFFFF9500),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )

                    IconButton(
                        onClick = { sendCommand("INPUT", TVKeyCodes.TV_INPUT) },
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF1A1D24))
                    ) {
                        Text("📺", fontSize = 15.sp)
                    }
                }

                // Channel Pillar
                Column(
                    modifier = Modifier
                        .width(72.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFF1A1D24))
                        .padding(vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    IconButton(
                        onClick = { sendCommand("CHANNEL_UP", TVKeyCodes.CHANNEL_UP) },
                        modifier = Modifier.size(38.dp)
                    ) {
                        Text("▲", color = Color.White, fontSize = 16.sp)
                    }

                    Text("CH", color = Color(0xFF9CA3AF), fontSize = 10.sp, fontWeight = FontWeight.Bold)

                    IconButton(
                        onClick = { sendCommand("CHANNEL_DOWN", TVKeyCodes.CHANNEL_DOWN) },
                        modifier = Modifier.size(38.dp)
                    ) {
                        Text("▼", color = Color.White, fontSize = 16.sp)
                    }
                }
            }
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
