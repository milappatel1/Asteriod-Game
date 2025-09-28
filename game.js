let game = {
    money: 0,
    inventory: {}, // Stores fish counts: { 'Trout': 5, 'Bass': 2, ... }
    stats: {
        totalFishCaught: 0,
        totalMoneyEarned: 0,
        totalClicks: 0
    },
    fishPerClickBase: 1, // Fish count per successful reel-in
    fishPerSecond: 0,
    buildings: {}, // Stores building counts
    upgrades: {}, // Stores upgrade state
    isLineCast: false
};

const FISH_TYPES = [
    { name: 'Minnow', baseValue: 1, rarity: 'Common', emoji: '🐠' },
    { name: 'Trout', baseValue: 5, rarity: 'Common', emoji: '🐟' },
    { name: 'Salmon', baseValue: 25, rarity: 'Uncommon', emoji: '🍣' },
    { name: 'Tuna', baseValue: 100, rarity: 'Rare', emoji: '🐡' },
    { name: 'Swordfish', baseValue: 500, rarity: 'Epic', emoji: '⚔️' },
    { name: 'Giant Squid', baseValue: 5000, rarity: 'Legendary', emoji: '🦑' },
];

const SHOP_ITEMS = {
    buildings: [
        { id: 'rod', name: 'Fishing Rods', baseCost: 10, costScale: 1.15, effect: 0.1, description: 'Basic FPS: +0.1' },
        { id: 'net', name: 'Nets', baseCost: 100, costScale: 1.15, effect: 1, description: 'Passive FPS: +1.0' },
        { id: 'boat', name: 'Fishing Boats', baseCost: 1100, costScale: 1.15, effect: 8, description: 'Passive FPS: +8.0' },
        { id: 'trawler', name: 'Trawlers', baseCost: 12000, costScale: 1.15, effect: 47, description: 'Passive FPS: +47.0' },
        // ... more buildings can be added here
    ],
    upgrades: [
        { id: 'sharper_hook', name: 'Sharper Hook', cost: 100, effect: 2, type: 'fpc', description: 'Doubles Fish Per Click', purchased: false },
        { id: 'better_bait', name: 'Better Bait', cost: 500, effect: 0.25, type: 'multiplier', description: 'All FPS +25%', purchased: false },
        // ... more upgrades can be added here
    ]
};

// --- CORE GAME MECHANICS ---

/**
 * Initiates the fishing attempt by enabling the 'Reel In' button.
 */
function castLine() {
    if (game.isLineCast) return; // Prevent double cast

    game.isLineCast = true;
    game.stats.totalClicks++;
    document.getElementById('cast-button').disabled = true;
    document.getElementById('reel-button').disabled = false;
    document.getElementById('catch-status').innerText = 'Line is cast... **Reel In!**';
}

/**
 * Completes the fishing attempt, adds a random fish to inventory, and resets the cast.
 */
function reelIn() {
    if (!game.isLineCast) return; // Must cast first

    game.isLineCast = false;
    game.stats.totalClicks++;
    document.getElementById('cast-button').disabled = false;
    document.getElementById('reel-button').disabled = true;

    // Simulate catching a fish based on weighted rarity
    const maxRarity = Math.random(); // 0.0 to 1.0
    let caughtFish;

    if (maxRarity < 0.01) { // 1% chance for Legendary
        caughtFish = FISH_TYPES.find(f => f.rarity === 'Legendary');
    } else if (maxRarity < 0.05) { // 4% chance for Epic
        caughtFish = FISH_TYPES.find(f => f.rarity === 'Epic');
    } else if (maxRarity < 0.15) { // 10% chance for Rare
        caughtFish = FISH_TYPES.find(f => f.rarity === 'Rare');
    } else if (maxRarity < 0.35) { // 20% chance for Uncommon
        caughtFish = FISH_TYPES.find(f => f.rarity === 'Uncommon');
    } else { // 65% chance for Common
        caughtFish = FISH_TYPES[Math.floor(Math.random() * 2)]; // Minnow or Trout
    }

    const fishAmount = calculateFPC();
    const fishName = caughtFish.name;

    // Add fish to inventory
    game.inventory[fishName] = (game.inventory[fishName] || 0) + fishAmount;
    game.stats.totalFishCaught += fishAmount;

    showNotification(`Caught ${fishAmount} ${caughtFish.emoji} **${fishName}**!`, 'good');
    document.getElementById('catch-status').innerText = `You caught ${fishAmount} ${fishName}! Press **Cast** again.`;

    updateDisplay();
    renderInventory();
}

/**
 * Calculates the current Fish Per Click (FPC) value.
 * @returns {number} The effective FPC.
 */
function calculateFPC() {
    let fpc = game.fishPerClickBase;
    // Apply FPC-specific upgrades (like sharper hook)
    SHOP_ITEMS.upgrades.filter(u => u.type === 'fpc' && game.upgrades[u.id]).forEach(upgrade => {
        fpc *= upgrade.effect; // e.g., Sharper Hook doubles it
    });
    return Math.floor(fpc);
}

/**
 * Calculates the current Fish Per Second (FPS) value.
 * @returns {number} The effective FPS.
 */
function calculateFPS() {
    let fps = 0;
    // Calculate base FPS from buildings
    SHOP_ITEMS.buildings.forEach(building => {
        const count = game.buildings[building.id] || 0;
        fps += count * building.effect;
    });

    // Apply multiplier upgrades
    SHOP_ITEMS.upgrades.filter(u => u.type === 'multiplier' && game.upgrades[u.id]).forEach(upgrade => {
        fps *= (1 + upgrade.effect); // e.g., Better Bait gives *1.25
    });

    game.fishPerSecond = fps;
    return fps;
}

/**
 * Main game loop: Runs every second to apply FPS.
 */
function gameLoop() {
    const fps = calculateFPS();
    const fishCaught = fps;

    // Passive fish collection (automatically adds to inventory)
    if (fishCaught > 0) {
        // For simplicity, we'll auto-add a basic fish type (Minnow)
        const passiveFishName = 'Minnow';
        game.inventory[passiveFishName] = (game.inventory[passiveFishName] || 0) + fishCaught;
        game.stats.totalFishCaught += fishCaught;

        if (fishCaught > 1) { // Only show notification for meaningful passive income
            showNotification(`+${fishCaught} 🐠 from buildings!`, 'passive');
        }
    }

    updateDisplay();
    renderInventory();
    saveGame(); // Auto-save every second
}

// --- SHOP/PURCHASING ---

/**
 * Calculates the cost of the next item purchase.
 * @param {object} item - The shop item object.
 * @param {number} currentCount - The number of items already owned.
 * @returns {number} The cost in money.
 */
function calculateCost(item, currentCount) {
    return Math.floor(item.baseCost * Math.pow(item.costScale, currentCount));
}

/**
 * Handles the purchase of a building.
 * @param {string} itemId - The ID of the building.
 */
function buyBuilding(itemId) {
    const building = SHOP_ITEMS.buildings.find(b => b.id === itemId);
    const currentCount = game.buildings[itemId] || 0;
    const cost = calculateCost(building, currentCount);

    if (game.money >= cost) {
        game.money -= cost;
        game.buildings[itemId] = currentCount + 1;
        showNotification(`Purchased **${building.name}**!`, 'buy');
        renderShop();
        updateDisplay();
    } else {
        showNotification('Not enough money!', 'alert');
    }
}

/**
 * Handles the purchase of an upgrade.
 * @param {string} upgradeId - The ID of the upgrade.
 */
function buyUpgrade(upgradeId) {
    const upgrade = SHOP_ITEMS.upgrades.find(u => u.id === upgradeId);

    if (game.upgrades[upgradeId]) {
        showNotification('Already purchased!', 'alert');
        return;
    }

    if (game.money >= upgrade.cost) {
        game.money -= upgrade.cost;
        game.upgrades[upgradeId] = true;
        showNotification(`Purchased **${upgrade.name}**!`, 'buy');
        renderShop();
        updateDisplay();
    } else {
        showNotification('Not enough money!', 'alert');
    }
}

// --- INVENTORY & SELLING ---

/**
 * Sells a specific type of fish from the inventory.
 * @param {string} fishName - The name of the fish type to sell.
 * @param {number} [amount=1] - The quantity to sell (default is 1).
 */
function sellFish(fishName, amount = 1) {
    if (game.inventory[fishName] && game.inventory[fishName] >= amount) {
        const fishData = FISH_TYPES.find(f => f.name === fishName);
        const sellValue = fishData.baseValue;
        const totalEarnings = sellValue * amount;

        game.money += totalEarnings;
        game.stats.totalMoneyEarned += totalEarnings;
        game.inventory[fishName] -= amount;

        if (game.inventory[fishName] === 0) {
            delete game.inventory[fishName];
        }

        showNotification(`Sold ${amount} ${fishData.emoji} ${fishName} for 💰${totalEarnings}!`, 'sell');
        updateDisplay();
        renderInventory();
    }
}

/**
 * Sells all fish currently in the inventory.
 */
function sellAllFish() {
    let totalEarnings = 0;
    let fishSoldCount = 0;

    for (const fishName in game.inventory) {
        const amount = game.inventory[fishName];
        if (amount > 0) {
            const fishData = FISH_TYPES.find(f => f.name === fishName);
            const sellValue = fishData.baseValue;
            totalEarnings += sellValue * amount;
            fishSoldCount += amount;
        }
    }

    if (totalEarnings > 0) {
        game.money += totalEarnings;
        game.stats.totalMoneyEarned += totalEarnings;
        game.inventory = {}; // Clear inventory
        showNotification(`Sold all ${fishSoldCount} fish for a total of 💰${totalEarnings}!`, 'sell-all');
        updateDisplay();
        renderInventory();
    } else {
        showNotification('Inventory is empty!', 'alert');
    }
}

// --- RENDERING & UI UPDATES ---

/**
 * Switches the displayed game page.
 * @param {string} pageId - The ID of the page to show (e.g., 'fishing', 'inventory').
 */
function showPage(pageId) {
    document.querySelectorAll('.game-page').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById(pageId + '-page').style.display = 'block';

    // Rerender specific pages when shown
    if (pageId === 'inventory') renderInventory();
    if (pageId === 'shop') renderShop();
    if (pageId === 'stats') renderStats();
}

/**
 * Updates the main statistics displays (Money, FPC, FPS).
 */
function updateDisplay() {
    document.getElementById('fish-count-display').innerText = `💰 **Money:** ${Math.floor(game.money).toLocaleString()}`;
    document.getElementById('fps-display').innerText = `🎣 **FPS:** ${calculateFPS().toFixed(1)}`;
    document.getElementById('fpc-display').innerText = `👆 **FPC:** ${calculateFPC()}`;
}

/**
 * Renders the list of fish in the inventory.
 */
function renderInventory() {
    const inventoryList = document.getElementById('inventory-list');
    inventoryList.innerHTML = '';
    const sortedFish = FISH_TYPES.filter(f => game.inventory[f.name] > 0).sort((a, b) => b.baseValue - a.baseValue);

    if (sortedFish.length === 0) {
        inventoryList.innerHTML = '<p>Your nets are empty!</p>';
        document.getElementById('sell-all-button').disabled = true;
        return;
    }
    document.getElementById('sell-all-button').disabled = false;

    sortedFish.forEach(fish => {
        const count = game.inventory[fish.name];
        const sellValue = fish.baseValue;
        const totalValue = count * sellValue;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';
        itemDiv.innerHTML = `
            <span>**${fish.emoji} ${fish.name}** (${fish.rarity}) x${count.toLocaleString()}</span>
            <span>**Value:** 💰${totalValue.toLocaleString()} (💰${sellValue}/ea)</span>
            <button onclick="sellFish('${fish.name}', ${count})" class="sell-button">Sell All</button>
        `;
        inventoryList.appendChild(itemDiv);
    });
}

/**
 * Renders the shop items (Buildings and Upgrades).
 */
function renderShop() {
    const buildingsList = document.getElementById('buildings-list');
    const upgradesList = document.getElementById('upgrades-list');
    buildingsList.innerHTML = '<h2>🏗️ Buildings (FPS)</h2>';
    upgradesList.innerHTML = '<h2>✨ Upgrades (FPC & Efficiency)</h2>';

    // Render Buildings
    SHOP_ITEMS.buildings.forEach(item => {
        const count = game.buildings[item.id] || 0;
        const cost = calculateCost(item, count);
        const canAfford = game.money >= cost;

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-info">
                <strong>${item.name}</strong> (Owned: ${count})
                <p>Effect: ${item.description}</p>
                <p>Cost: 💰${cost.toLocaleString()}</p>
            </div>
            <button onclick="buyBuilding('${item.id}')" ${!canAfford ? 'disabled' : ''}>Buy One</button>
        `;
        buildingsList.appendChild(card);
    });

    // Render Upgrades
    SHOP_ITEMS.upgrades.forEach(item => {
        const purchased = game.upgrades[item.id];
        const canAfford = game.money >= item.cost;

        if (purchased) return; // Hide purchased upgrades

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-info">
                <strong>${item.name}</strong>
                <p>Effect: ${item.description}</p>
                <p>Cost: 💰${item.cost.toLocaleString()}</p>
            </div>
            <button onclick="buyUpgrade('${item.id}')" ${!canAfford ? 'disabled' : ''}>Buy</button>
        `;
        upgradesList.appendChild(card);
    });
}

/**
 * Renders the main statistics page.
 */
function renderStats() {
    document.getElementById('stat-total-fish').innerText = game.stats.totalFishCaught.toLocaleString();
    document.getElementById('stat-total-money').innerText = game.stats.totalMoneyEarned.toLocaleString();
    document.getElementById('stat-total-clicks').innerText = game.stats.totalClicks.toLocaleString();
}

/**
 * Shows a temporary notification message on the screen.
 * @param {string} message - The notification text.
 * @param {string} type - The type of notification (for styling, not implemented in CSS fully here).
 */
function showNotification(message, type) {
    const area = document.getElementById('notification-area');
    const note = document.createElement('div');
    note.className = `notification show ${type}`;
    note.innerHTML = message;
    area.appendChild(note);

    setTimeout(() => {
        note.classList.remove('show');
        setTimeout(() => {
            area.removeChild(note);
        }, 500); // Wait for transition to finish
    }, 3000);
}

// --- SAVE / LOAD / INITIALIZATION ---

/**
 * Saves the current game state to Local Storage.
 */
function saveGame() {
    localStorage.setItem('fishClickerGame', JSON.stringify(game));
    // console.log('Game Saved!');
}

/**
 * Loads the game state from Local Storage.
 */
function loadGame() {
    const savedGame = localStorage.getItem('fishClickerGame');
    if (savedGame) {
        // Merge saved data over initial state to handle new properties
        const loadedData = JSON.parse(savedGame);
        game = { ...game, ...loadedData };
        // Ensure complex objects are initialized if they were empty in the save
        game.inventory = loadedData.inventory || {};
        game.buildings = loadedData.buildings || {};
        game.upgrades = loadedData.upgrades || {};
        game.stats = loadedData.stats || {};

        showNotification('Game Loaded!', 'info');
    }
}

/**
 * Resets the game to the initial state (with confirmation).
 */
function resetGame() {
    if (confirm('Are you sure you want to reset ALL progress? This cannot be undone.')) {
        localStorage.removeItem('fishClickerGame');
        window.location.reload(); // Quickest way to reset the global state
    }
}

/**
 * Initializes the game on page load.
 */
function initGame() {
    loadGame();
    updateDisplay();
    renderShop();
    renderInventory();
    showPage('fishing'); // Start on the main fishing page

    // Start the main game loop (runs every 1000ms = 1 second)
    setInterval(gameLoop, 1000);
}

// Global functions for HTML access
window.showPage = showPage;
window.castLine = castLine;
window.reelIn = reelIn;
window.buyBuilding = buyBuilding;
window.buyUpgrade = buyUpgrade;
window.sellAllFish = sellAllFish;
window.sellFish = sellFish;
window.saveGame = saveGame;
window.resetGame = resetGame;

// Start the game!
document.addEventListener('DOMContentLoaded', initGame);
