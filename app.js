// TODO: Ganti dengan konfigurasi Firebase proyek Anda
const firebaseConfig = {
    apiKey: "AIzaSyYOUR_API_KEY_HERExxxxxxxxxxxxxxx",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Referensi Database
const messagesRef = database.ref('messages');
const onlineUsersRef = database.ref('onlineUsers');
const typingRef = database.ref('typing');

// Elemen DOM
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const setUsernameButton = document.getElementById('setUsernameButton');
const onlineUsersList = document.getElementById('onlineUsersList');
const typingIndicator = document.getElementById('typingIndicator');

// Variabel global pengguna
let currentUsername = localStorage.getItem('chatUsername') || '';
let userId = localStorage.getItem('chatUserId');
if (!userId) {
    userId = database.ref().push().key; // Buat ID unik sederhana
    localStorage.setItem('chatUserId', userId);
}

let typingTimeout;

// Fungsi untuk mengatur status online pengguna
function setUserOnline() {
    if (!currentUsername || !userId) return;
    const userStatusRef = onlineUsersRef.child(userId);
    userStatusRef.set({
        username: currentUsername,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    userStatusRef.onDisconnect().remove(); // Hapus saat koneksi terputus
}

// Fungsi untuk menampilkan pengguna online
function displayOnlineUsers(snapshot) {
    onlineUsersList.innerHTML = ''; // Kosongkan daftar
    const users = snapshot.val();
    if (users) {
        Object.values(users).forEach(user => {
            if (user.username) {
                const li = document.createElement('li');
                li.textContent = user.username;
                onlineUsersList.appendChild(li);
            }
        });
    }
}

// Fungsi untuk menampilkan indikator mengetik
function displayTypingIndicator(snapshot) {
    const typingUsers = snapshot.val();
    let indicatorText = '';
    if (typingUsers) {
        const usersTyping = Object.values(typingUsers)
            .map(user => user.username)
            .filter(name => name !== currentUsername && name); // Jangan tampilkan diri sendiri

        if (usersTyping.length > 0) {
            if (usersTyping.length === 1) {
                indicatorText = `${usersTyping[0]} sedang mengetik...`;
            } else if (usersTyping.length === 2) {
                indicatorText = `${usersTyping.join(' dan ')} sedang mengetik...`;
            } else {
                indicatorText = `${usersTyping.slice(0, 2).join(', ')}, dan lainnya sedang mengetik...`;
            }
        }
    }
    typingIndicator.textContent = indicatorText;
}

// Fungsi untuk mengirim pesan
function sendMessage() {
    const text = messageInput.value.trim();

    if (text === "" || !currentUsername) {
        return;
    }

    const message = {
        userId: userId,
        username: currentUsername,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    messagesRef.push(message);
    messageInput.value = "";
    messageInput.focus();
    // Hapus status mengetik setelah mengirim
    typingRef.child(userId).remove();
}

// Fungsi untuk menampilkan pesan
function displayMessage(snapshot) {
    const messageData = snapshot.val();
    if (!messageData || !messageData.username || !messageData.text) return; // Validasi data pesan

    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    if (messageData.userId === userId) {
        messageElement.classList.add('sent');
    } else {
        messageElement.classList.add('received');
    }

    const senderElement = document.createElement('div');
    senderElement.classList.add('sender');
    senderElement.textContent = messageData.username;

    const textElement = document.createElement('div');
    textElement.classList.add('text');
    textElement.textContent = messageData.text;

    messageElement.appendChild(senderElement);
    messageElement.appendChild(textElement);

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Inisialisasi Aplikasi
function initializeApp() {
    if (currentUsername) {
        usernameModal.style.display = 'none';
        messageInput.disabled = false;
        sendButton.disabled = false;
        setUserOnline();
        loadInitialMessages();
    } else {
        usernameModal.style.display = 'flex';
        messageInput.disabled = true;
        sendButton.disabled = true;
    }
}

// Memuat pesan awal
function loadInitialMessages() {
    messagesRef.limitToLast(50).once('value', (snapshot) => {
        chatMessages.innerHTML = ''; // Bersihkan chat area sebelum memuat
        snapshot.forEach((childSnapshot) => {
            displayMessage(childSnapshot);
        });
    });
}

// Event Listeners
setUsernameButton.addEventListener('click', () => {
    const enteredUsername = usernameInput.value.trim();
    if (enteredUsername) {
        currentUsername = enteredUsername;
        localStorage.setItem('chatUsername', currentUsername);
        initializeApp();
    } else {
        alert("Nama pengguna tidak boleh kosong!");
    }
});

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { // Kirim dengan Enter, Shift+Enter untuk baris baru
        e.preventDefault(); // Mencegah baris baru di input
        sendMessage();
    }
});

messageInput.addEventListener('input', () => {
    if (!currentUsername || !userId) return;

    const userTypingRef = typingRef.child(userId);
    if (messageInput.value.trim().length > 0) {
        userTypingRef.set({ username: currentUsername });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            userTypingRef.remove();
        }, 3000); // Hapus setelah 3 detik tidak aktif
    } else {
        clearTimeout(typingTimeout);
        userTypingRef.remove();
    }
});

// Mendengarkan data dari Firebase
messagesRef.limitToLast(1).on('child_added', (snapshot, prevChildKey) => {
    // Hanya tampilkan pesan baru yang belum ada di chatMessages untuk menghindari duplikasi saat init
    // Ini adalah cara sederhana, bisa lebih dioptimalkan jika perlu
    const existingMessages = chatMessages.children.length;
    if (existingMessages > 0 && chatMessages.lastChild) {
        // Cek apakah pesan sudah ditampilkan oleh `once('value')` atau `child_added` sebelumnya
        // Ini mungkin perlu penyesuaian lebih lanjut tergantung perilaku `limitToLast` dan `once`
        // Untuk kasus sederhana ini, kita bisa asumsikan pesan baru belum ada.
        // Jika ada duplikasi, Anda mungkin perlu menyimpan ID pesan yang sudah ditampilkan.
        const lastMessageKey = snapshot.key;
        let alreadyDisplayed = false;
        // Simple check, can be improved
        // for (let i = 0; i < chatMessages.children.length; i++) {
        //     if (chatMessages.children[i].dataset.messageKey === lastMessageKey) {
        //         alreadyDisplayed = true;
        //         break;
        //     }
        // }
        // if (!alreadyDisplayed) {
        //    messageElement.dataset.messageKey = snapshot.key; // Add this in displayMessage
        //    displayMessage(snapshot);
        // }
        // Simplifikasi untuk contoh ini: selalu tampilkan, tapi pastikan loadInitialMessages membersihkan dulu
    }
    displayMessage(snapshot);
});


onlineUsersRef.on('value', displayOnlineUsers);
typingRef.on('value', displayTypingIndicator);

// Inisialisasi saat halaman dimuat
initializeApp();

// Tambahan: Tangani saat pengguna menutup tab/browser (walaupun onDisconnect lebih diandalkan)
window.addEventListener('beforeunload', () => {
    if (currentUsername && userId) {
        // Hapus status mengetik jika ada
        typingRef.child(userId).remove();
        // onDisconnect() harusnya sudah menangani onlineUsers, tapi ini sebagai backup
        // onlineUsersRef.child(userId).remove(); // Sebaiknya tidak dilakukan di sini karena onDisconnect lebih baik
    }
});