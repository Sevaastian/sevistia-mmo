// ==========================================
// 1. GLOBAL VERİLER VE MULTIPLAYER (SOCKET)
// ==========================================
let playerData = {
    name: "Misafir", pass: "", skinColor: "#f1c40f",
    level: 1, coin: 100, diamond: 10,
    x: 0, y: 0, targetX: 0, targetY: 0, speed: 4, isMoving: false,
    dialogue: null,
    inventory: [],
    equipped: {
        sapka: null,
        gozluk: null,
        aksesuar: null
    }
};

let mapsData = {};
let npcsData = [];
let itemsData = [];
let questsData = [];
let currentMap = "meydan";
let activeDialogue = null; 
const images = {};

// YENİ: Socket.io bağlantısı (Sunucuya bağlanıyoruz)
const socket = io('http://localhost:3000');
let onlinePlayers = {}; // Diğer oyuncuları tutacağımız liste

socket.on('update_players', (playersFromServer) => {
    onlinePlayers = playersFromServer;
});

// Kaydetme Fonksiyonu
function saveGame() {
    if (playerData.name === "Misafir" || !playerData.name) return;
    
    let users = JSON.parse(localStorage.getItem('sevistia_users')) || [];
    let index = users.findIndex(u => u.name === playerData.name);
    if (index !== -1) {
        users[index] = playerData;
    } else {
        users.push(playerData);
    }
    
    localStorage.setItem('sevistia_users', JSON.stringify(users));
    localStorage.setItem('sevistia_active_user', playerData.name);
}

// Kayıt Olma Fonksiyonu
function registerUser() {
    const name = document.getElementById('char-name').value.trim();
    const pass = document.getElementById('char-pass').value.trim();
    const skinColor = document.getElementById('char-skin') ? document.getElementById('char-skin').value : "#f1c40f";

    if (!name || !pass) {
        alert("Kullanıcı adı ve şifre boş olamaz kanka!");
        return;
    }

    let users = JSON.parse(localStorage.getItem('sevistia_users')) || [];
    let existingUser = users.find(u => u.name === name);

    if (existingUser) {
        alert("Bu kullanıcı adı zaten alınmış! Giriş yapmayı dene.");
        return;
    }

    playerData.name = name;
    playerData.pass = pass;
    playerData.skinColor = skinColor;
    users.push(playerData);
    
    localStorage.setItem('sevistia_users', JSON.stringify(users));
    localStorage.setItem('sevistia_active_user', name);

    alert("Kayıt başarılı! Şimdi oyuna giriyorsun...");
    startGameEngineAndAssets();
}

// Giriş Yapma Fonksiyonu
function loginUser() {
    const name = document.getElementById('char-name').value.trim();
    const pass = document.getElementById('char-pass').value.trim();

    if (!name || !pass) {
        alert("Lütfen kullanıcı adı ve şifreni gir kanka!");
        return;
    }

    let users = JSON.parse(localStorage.getItem('sevistia_users')) || [];
    let user = users.find(u => u.name === name);

    if (!user) {
        alert("Böyle bir hesap bulunamadı! Önce 'Kayıt Ol'malısın.");
        return;
    }

    if (user.pass !== pass) {
        alert("Şifre yanlış kanka! Tekrar dene.");
        return;
    }

    playerData = user;
    localStorage.setItem('sevistia_active_user', name);

    alert(`Hoş geldin ${playerData.name}! Oyuna bağlanılıyor...`);
    startGameEngineAndAssets();
}

function loadImage(key, src) {
    return new Promise((resolve) => {
        let img = new Image();
        img.onload = () => { images[key] = img; resolve(); };
        img.onerror = () => { resolve(); };
        img.src = src;
    });
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active'); screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
    document.getElementById(screenId).classList.add('active');
}

window.onload = () => {
    let activeName = localStorage.getItem('sevistia_active_user');
    if (activeName) {
        let nameInput = document.getElementById('char-name');
        if (nameInput) nameInput.value = activeName;
    }

    let progress = 0;
    const loadingBar = document.getElementById('loading-bar');
    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 20) + 5;
        if (progress > 100) progress = 100;
        loadingBar.style.width = progress + '%';
        if (progress === 100) {
            clearInterval(interval);
            setTimeout(() => showScreen('main-menu'), 500);
        }
    }, 200);
};

async function startGameEngineAndAssets() {
    updateUI();
    saveGame();

    try {
        const [mapsRes, npcsRes, itemsRes, questsRes] = await Promise.all([
            fetch('data/maps.json'),
            fetch('data/npcs.json'),
            fetch('data/items.json'),
            fetch('data/quests.json')
        ]);
        
        mapsData = await mapsRes.json();
        npcsData = await npcsRes.json();
        itemsData = await itemsRes.json();
        questsData = await questsRes.json();

        const imagePromises = [
            loadImage('player', 'assets/player/player.png'),
            loadImage('muhtar', 'assets/npc/muhtar.png'),
            loadImage('tuccar', 'assets/npc/tuccar.png'),
            loadImage('bg_meydan', 'assets/maps/meydan.jpg'),
            loadImage('bg_kafe', 'assets/maps/kafe.jpg')
        ];

        itemsData.forEach(item => {
            imagePromises.push(loadImage('item_' + item.id, `assets/items/${item.id}.png`));
        });

        await Promise.all(imagePromises);
        
        showScreen('game-screen');
        initGameEngine();

        // Sunucuya oyuna katıldığını bildir
        socket.emit('join_game', {
            name: playerData.name,
            skinColor: playerData.skinColor,
            x: playerData.x,
            y: playerData.y,
            currentMap: currentMap,
            equipped: playerData.equipped
        });

    } catch (error) {
        console.error("Hata!", error);
        alert("Dosyalar okunamadı! Live Server açık mı?");
    }
}

function updateUI() {
    document.getElementById('ui-level').innerText = playerData.level;
    document.getElementById('ui-coin').innerText = playerData.coin;
    document.getElementById('ui-diamond').innerText = playerData.diamond;
    saveGame();
}

function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text.length > 0) {
        playerData.dialogue = { text: text, timer: 240 };
        input.value = ''; 
    }
}

function earnCoinFromCafe() {
    if (currentMap !== "kafe") {
        alert("Kahve yapıp satış yapmak için önce Kafe'ye gitmelisin kanka!");
        return;
    }

    let kazanilanCoin = 10;
    playerData.coin += kazanilanCoin;
    
    updateUI();
    saveGame();

    playerData.dialogue = { text: `☕ Kahve satıldı! +${kazanilanCoin} Coin`, timer: 120 };
}

function toggleMarket() {
    const modal = document.getElementById('market-modal');
    modal.classList.toggle('hidden');
    
    if (!modal.classList.contains('hidden')) {
        const grid = document.getElementById('market-items');
        grid.innerHTML = ''; 
        itemsData.forEach(item => {
            grid.innerHTML += `
                <div class="item-card">
                    <h4>${item.name}</h4>
                    <p>🪙 ${item.price} Coin</p>
                    <button class="buy-btn" onclick="buyItem('${item.id}')">Satın Al</button>
                </div>
            `;
        });
    }
}

function toggleInventory() {
    const modal = document.getElementById('inventory-modal');
    modal.classList.toggle('hidden');
    
    if (!modal.classList.contains('hidden')) {
        const grid = document.getElementById('inventory-items');
        grid.innerHTML = ''; 
        
        if (playerData.inventory.length === 0) {
            grid.innerHTML = "<p>Çantan bomboş!</p>";
        } else {
            playerData.inventory.forEach(itemId => {
                const itemInfo = itemsData.find(i => i.id === itemId);
                const isEquipped = playerData.equipped[itemInfo.type] === itemId;
                const buttonText = isEquipped ? "Çıkar" : "Giy";
                
                grid.innerHTML += `
                    <div class="item-card">
                        <h4>${itemInfo.name}</h4>
                        <p>Tür: ${itemInfo.type}</p>
                        <button class="buy-btn" onclick="equipItem('${itemId}')">${buttonText}</button>
                    </div>
                `;
            });
        }
    }
}

function buyItem(itemId) {
    const item = itemsData.find(i => i.id === itemId);
    if (playerData.inventory.includes(itemId)) {
        alert("Bu eşyaya zaten sahipsin!");
        return;
    }
    if (playerData.coin >= item.price) {
        playerData.coin -= item.price;
        playerData.inventory.push(itemId);
        updateUI();
        saveGame();
        alert(`${item.name} satın alındı ve kaydedildi!`);
    } else {
        alert("Yeterli coinin yok kanka!");
    }
}

function equipItem(itemId) {
    const itemInfo = itemsData.find(i => i.id === itemId);
    const itemType = itemInfo.type;

    if (playerData.equipped[itemType] === itemId) {
        playerData.equipped[itemType] = null;
    } else {
        playerData.equipped[itemType] = itemId;
    }

    saveGame();
    toggleInventory();
    toggleInventory();
}

// ==========================================
// 4. OYUN MOTORU VE ÇİZİM
// ==========================================
function initGameEngine() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    let locationUI = document.createElement('div');
    locationUI.id = "location-ui";
    locationUI.style.position = "absolute";
    locationUI.style.top = "70px"; 
    locationUI.style.left = "20px";
    locationUI.style.color = "white";
    locationUI.style.fontSize = "18px";
    locationUI.style.fontWeight = "bold";
    locationUI.style.textShadow = "2px 2px 4px black";
    document.getElementById('game-screen').appendChild(locationUI);

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    playerData.x = mapsData[currentMap].spawnX;
    playerData.y = mapsData[currentMap].spawnY;
    playerData.targetX = playerData.x;
    playerData.targetY = playerData.y;

    const clickMarker = { x: 0, y: 0, radius: 0, active: false };

    document.getElementById('chat-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') sendChat();
    });

    window.addEventListener('mousedown', (e) => {
        if (e.target.closest('#chat-bar') || e.target.closest('#game-ui-right') || e.target.closest('.modal')) return;

        const clickX = e.clientX;
        const clickY = e.clientY;
        let clickedOnNPC = false;

        const mapNpcs = npcsData.filter(npc => npc.map === currentMap);
        for (let npc of mapNpcs) {
            if (clickX >= npc.x - 48 && clickX <= npc.x + 48 &&
                clickY >= npc.y - 140 && clickY <= npc.y) {
                
                clickedOnNPC = true;
                playerData.isMoving = false;
                
                let dialogueText = npc.message;
                const quest = questsData.find(q => q.giver === npc.id);
                
                if (quest) {
                    const today = new Date().toISOString().slice(0, 10);
                    
                    if (quest.lastCompletedDate === today) {
                        dialogueText = `${npc.name}: Bugünlük çay bitti kanka! Yarın yeniden gel.`;
                    } else {
                        dialogueText = `${quest.title}: ${quest.description}`;
                        quest.lastCompletedDate = today;
                        playerData.coin += quest.reward;
                        updateUI();
                        saveGame();
                        setTimeout(() => {
                            alert(`Tebrikler! "${quest.title}" görevi tamamlandı. +${quest.reward} Coin kazandın! Yarın tekrar bekleriz.`);
                        }, 100);
                    }
                }

                activeDialogue = { text: dialogueText, x: npc.x, y: npc.y - 180, timer: 300 };
                break;
            }
        }

        if (!clickedOnNPC) {
            playerData.targetX = clickX;
            playerData.targetY = clickY;
            playerData.isMoving = true;
            activeDialogue = null; 

            clickMarker.x = clickX;
            clickMarker.y = clickY;
            clickMarker.radius = 15;
            clickMarker.active = true;
        }
    });

    function gameLoop() {
        const mapInfo = mapsData[currentMap];

        if (locationUI.innerText !== `📍 ${mapInfo.name}`) {
            locationUI.innerText = `📍 ${mapInfo.name}`;
        }

        if (playerData.isMoving) {
            const dx = playerData.targetX - playerData.x;
            const dy = playerData.targetY - playerData.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > playerData.speed) {
                playerData.x += (dx / distance) * playerData.speed;
                playerData.y += (dy / distance) * playerData.speed;
            } else {
                playerData.x = playerData.targetX;
                playerData.y = playerData.targetY;
                playerData.isMoving = false;
            }

            // Hareket ederken konumunu sunucuya bildir
            socket.emit('player_move', {
                x: playerData.x,
                y: playerData.y,
                currentMap: currentMap,
                equipped: playerData.equipped
            });
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const bgKey = 'bg_' + mapInfo.id;
        if (images[bgKey]) {
            ctx.drawImage(images[bgKey], 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = mapInfo.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        if (mapInfo.doors) {
            for (let door of mapInfo.doors) {
                ctx.fillStyle = 'rgba(241, 196, 15, 0.3)';
                ctx.fillRect(door.x, door.y, door.width, door.height);
                ctx.strokeStyle = '#f1c40f';
                ctx.lineWidth = 2;
                ctx.strokeRect(door.x, door.y, door.width, door.height);
                
                ctx.fillStyle = 'white';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(door.label, door.x + (door.width / 2), door.y - 10);

                if (playerData.x >= door.x && playerData.x <= door.x + door.width &&
                    playerData.y >= door.y && playerData.y <= door.y + door.height) {
                    
                    currentMap = door.targetMap;
                    
                    const cafeBtn = document.getElementById('cafe-btn');
                    if (cafeBtn) {
                        if (currentMap === 'kafe') {
                            cafeBtn.classList.remove('hidden');
                        } else {
                            cafeBtn.classList.add('hidden');
                        }
                    }

                    const nextMap = mapsData[currentMap];
                    playerData.x = nextMap.spawnX;
                    playerData.y = nextMap.spawnY;
                    playerData.targetX = nextMap.spawnX;
                    playerData.targetY = nextMap.spawnY;
                    
                    playerData.isMoving = false;
                    clickMarker.active = false;

                    // Harita değiştiğini sunucuya bildir
                    socket.emit('player_move', {
                        x: playerData.x,
                        y: playerData.y,
                        currentMap: currentMap,
                        equipped: playerData.equipped
                    });

                    break; 
                }
            }
        }

        if (clickMarker.active) {
            ctx.beginPath();
            ctx.arc(clickMarker.x, clickMarker.y, clickMarker.radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.stroke();
            clickMarker.radius -= 0.5;
            if (clickMarker.radius <= 0) clickMarker.active = false;
        }

        // NPC'leri Çiz
        const mapNpcs = npcsData.filter(npc => npc.map === currentMap);
        for (let npc of mapNpcs) {
            if (images[npc.id]) {
                ctx.drawImage(images[npc.id], npc.x - 48, npc.y - 140, 96, 144);
            } else {
                ctx.fillStyle = npc.color;
                ctx.fillRect(npc.x - 20, npc.y - 20, 40, 40);
            }
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(npc.name, npc.x, npc.y - 150);
        }

        // YENİ: Diğer Çevrimiçi Oyuncuları Çiz
        for (let id in onlinePlayers) {
            const p = onlinePlayers[id];
            if (p.id !== socket.id && p.currentMap === currentMap) {
                if (images['player']) {
                    ctx.drawImage(images['player'], p.x - 48, p.y - 140, 96, 144);
                    
                    // Diğer oyuncunun giysilerini çiz
                    for (let type in p.equipped) {
                        const eqId = p.equipped[type];
                        if (eqId && images['item_' + eqId]) {
                            if (type === 'sapka') {
                                ctx.drawImage(images['item_' + eqId], p.x - 30, p.y - 130, 60, 60);
                            } else if (type === 'gozluk') {
                                ctx.drawImage(images['item_' + eqId], p.x - 14, p.y - 98, 28, 28);
                            }
                        }
                    }
                } else {
                    ctx.fillStyle = p.skinColor || '#f1c40f';
                    ctx.fillRect(p.x - 20, p.y - 20, 40, 40);
                }
                ctx.fillStyle = '#f1c40f'; // Diğer oyuncuların ismi sarı olsun
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(p.name, p.x, p.y - 150);
            }
        }

        // Kendi Karakterini Çiz
        if (images['player']) {
            ctx.drawImage(images['player'], playerData.x - 48, playerData.y - 140, 96, 144);
            
            for (let type in playerData.equipped) {
                const equippedId = playerData.equipped[type];
                if (equippedId && images['item_' + equippedId]) {
                    if (type === 'sapka') {
                        ctx.drawImage(images['item_' + equippedId], playerData.x - 30, playerData.y - 130, 60, 60);
                    } else if (type === 'gozluk') {
                        ctx.drawImage(images['item_' + equippedId], playerData.x - 14, playerData.y - 98, 28, 28);
                    } else {
                        ctx.drawImage(images['item_' + equippedId], playerData.x - 48, playerData.y - 140, 96, 144);
                    }
                }
            }
        } else {
            ctx.fillStyle = playerData.skinColor;
            ctx.fillRect(playerData.x - 20, playerData.y - 20, 40, 40);
        }

        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(playerData.name, playerData.x, playerData.y - 150);

        function drawBubble(text, x, y) {
            ctx.font = '14px Arial';
            const textWidth = ctx.measureText(text).width;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.roundRect(x - (textWidth/2) - 10, y - 25, textWidth + 20, 35, 10);
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.fillText(text, x, y - 2);
        }

        if (activeDialogue) {
            drawBubble(activeDialogue.text, activeDialogue.x, activeDialogue.y);
            activeDialogue.timer--;
            if (activeDialogue.timer <= 0) activeDialogue = null;
        }

        if (playerData.dialogue) {
            drawBubble(playerData.dialogue.text, playerData.x, playerData.y - 180);
            playerData.dialogue.timer--;
            if (playerData.dialogue.timer <= 0) playerData.dialogue = null;
        }

        requestAnimationFrame(gameLoop);
    }
    
    gameLoop();
}