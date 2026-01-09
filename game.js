import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';
import {
    getUserStats,
    upsertUserStats,
    recordSpin,
    getSpinHistory,
    syncLocalToDatabase,
    incrementStats,
    getLeaderboard
} from './supabase.js';

const BASE_CHAIN_ID = 8453;

const SPINON_CONTRACT_ADDRESS = '0xf4387897225ac65BA59858148D3c2BeFCdA8075C';
const SPIN_FEE = '0.0001';

// Function Selectors
const SPIN_FUNCTION_SELECTOR = '0xf0acd7d5';           // spin()
const SPIN_FEE_SELECTOR = '0x2c4106bd';               // spinFee()
const CLAIM_WINNINGS_SELECTOR = '0xb401faf1';         // claimWinnings()
const PENDING_WINNINGS_SELECTOR = '0x68463349';       // pendingWinnings(address)

let farcasterUser = null;
let currentChainId = null;
let walletAddress = null;
let userId = null;

function extractWalletAddress(user) {
    if (!user) return null;
    if (user.connectedAddress) return user.connectedAddress;
    if (user.custody_address) return user.custody_address;
    if (user.custodyAddress) return user.custodyAddress;
    if (user.verifiedAddresses) {
        if (Array.isArray(user.verifiedAddresses) && user.verifiedAddresses.length > 0) {
            return user.verifiedAddresses[0];
        }
        if (user.verifiedAddresses.ethAddresses && user.verifiedAddresses.ethAddresses.length > 0) {
            return user.verifiedAddresses.ethAddresses[0];
        }
    }
    if (user.verifications && user.verifications.length > 0) {
        return user.verifications[0];
    }
    return null;
}

async function initFarcaster() {
    try {
        const context = await sdk.context;
        console.log('Farcaster context:', context);
        if (context?.user) {
            farcasterUser = context.user;
            walletAddress = extractWalletAddress(context.user);
            userId = context.user.fid?.toString() || walletAddress || null;
            console.log('Wallet address found:', walletAddress);
        }

        const walletProvider = sdk.wallet?.getEthereumProvider?.() || sdk.wallet?.ethProvider;
        if (walletProvider) {
            try {
                const accounts = await walletProvider.request({ method: 'eth_accounts' });
                if (accounts && accounts.length > 0 && accounts[0]) {
                    walletAddress = accounts[0];
                }
            } catch (e) {
                console.log('Could not get accounts from SDK provider');
            }
        }

        sdk.actions.ready();
        checkNetwork();
        updateWalletDisplay();
        syncUserData();
    } catch (e) {
        console.log('Farcaster context not available:', e);
        try {
            sdk.actions.ready();
        } catch (readyError) {
            console.log('SDK ready failed:', readyError);
        }
        updateWalletDisplay();
        if (!userId && walletAddress) {
            userId = walletAddress;
            syncUserData();
        }
    }
}

async function syncUserData() {
    if (!userId) return;

    try {
        const localStats = {
            totalSpins,
            totalWins,
            totalWinnings,
            totalPoints: Math.floor(totalWinnings * 1000)
        };

        const username = farcasterUser?.displayName || farcasterUser?.username || '';
        const pfpUrl = farcasterUser?.pfpUrl || '';

        await syncLocalToDatabase(userId, localStats, username, pfpUrl);

        const dbStats = await getUserStats(userId);
        if (dbStats) {
            if (dbStats.total_spins > totalSpins) {
                totalSpins = dbStats.total_spins;
                localStorage.setItem('totalSpins', totalSpins.toString());
                if (totalSpinsEl) totalSpinsEl.textContent = totalSpins;
            }
            if (dbStats.total_wins > totalWins) {
                totalWins = dbStats.total_wins;
                localStorage.setItem('totalWins', totalWins.toString());
            }
            if (parseFloat(dbStats.total_usdc) > totalWinnings) {
                totalWinnings = parseFloat(dbStats.total_usdc);
                localStorage.setItem('totalWinnings', totalWinnings.toString());
                updateWinningsDisplay();
            }
        }
    } catch (e) {
        console.error('Error syncing user data:', e);
    }
}

async function checkNetwork() {
    try {
        const provider = sdk?.wallet?.getEthereumProvider?.() || sdk?.wallet?.ethProvider || window.ethereum;
        if (provider) {
            const chainId = await provider.request({ method: 'eth_chainId' });
            currentChainId = parseInt(chainId, 16);
            updateNetworkStatus();

            if (provider.on) {
                provider.on('chainChanged', (newChainId) => {
                    currentChainId = parseInt(newChainId, 16);
                    updateNetworkStatus();
                });

                provider.on('accountsChanged', (accounts) => {
                    if (accounts && accounts.length > 0) {
                        walletAddress = accounts[0];
                        updateWalletDisplay();
                    }
                });
            }
        } else {
            currentChainId = BASE_CHAIN_ID;
            updateNetworkStatus();
        }
    } catch (e) {
        console.log('Network check not available:', e);
        currentChainId = BASE_CHAIN_ID;
        updateNetworkStatus();
    }
}

function updateNetworkStatus() {
    const walletCard = document.querySelector('.wallet-card');
    const walletEl = document.getElementById('walletAddress');
    if (!walletCard || !walletEl) return;

    const isCorrectNetwork = currentChainId === BASE_CHAIN_ID;

    if (!isCorrectNetwork && currentChainId !== null) {
        walletCard.classList.add('wrong-network');
        walletEl.textContent = 'Switch Network';
        walletCard.onclick = switchToBase;
    } else {
        walletCard.classList.remove('wrong-network');
        walletCard.onclick = null;
        updateWalletDisplay();
    }
}

async function connectWallet() {
    try {
        const context = await sdk.context;
        console.log('Connect wallet - context:', context);
        if (context?.user) {
            walletAddress = extractWalletAddress(context.user);
            console.log('Connect wallet - extracted address:', walletAddress);

            if (walletAddress) {
                updateWalletDisplay();
                await checkNetwork();
                return true;
            }
        }
    } catch (e) {
        console.log('Farcaster context check failed:', e);
    }

    const provider = sdk?.wallet?.getEthereumProvider?.() || sdk?.wallet?.ethProvider || window.ethereum;

    if (provider) {
        try {
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            if (accounts && accounts.length > 0) {
                walletAddress = accounts[0];
                updateWalletDisplay();
                await checkNetwork();
                return true;
            }
        } catch (e) {
            console.error('Provider wallet connection error:', e);
        }
    }

    if (sdk?.wallet?.sendTransaction) {
        console.log('SDK wallet.sendTransaction available, proceeding without explicit wallet address');
        return true;
    }

    showSpinStatus('Wallet connection failed. Open in Warpcast.', true);
    return false;
}

async function switchToBase() {
    const provider = sdk?.wallet?.getEthereumProvider?.() || sdk?.wallet?.ethProvider || window.ethereum;
    if (!provider) return;

    try {
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
        });
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x2105',
                        chainName: 'Base',
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://mainnet.base.org'],
                        blockExplorerUrls: ['https://basescan.org']
                    }],
                });
            } catch (addError) {
                console.error('Failed to add Base network');
            }
        }
    }
}

function updateWalletDisplay() {
    const walletEl = document.getElementById('walletAddress');
    const walletCard = document.querySelector('.wallet-card');
    const connectionStatus = document.getElementById('connectionStatus');
    const networkIndicator = document.getElementById('networkIndicator');
    if (!walletEl) return;

    const isConnected = walletAddress || farcasterUser;
    const isCorrectNetwork = currentChainId === BASE_CHAIN_ID || !currentChainId;

    if (connectionStatus) {
        if (isConnected) {
            connectionStatus.textContent = 'Connected';
            connectionStatus.classList.remove('disconnected');
        } else {
            connectionStatus.textContent = 'Not Connected';
            connectionStatus.classList.add('disconnected');
        }
    }

    if (networkIndicator) {
        if (!isCorrectNetwork) {
            networkIndicator.classList.add('wrong-network');
        } else {
            networkIndicator.classList.remove('wrong-network');
        }
    }

    if (walletCard?.classList.contains('wrong-network')) return;

    if (walletAddress) {
        walletEl.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-3)}`;
        if (walletCard) walletCard.onclick = null;
    } else if (farcasterUser?.username) {
        walletEl.textContent = `@${farcasterUser.username}`;
        if (walletCard) walletCard.onclick = connectWallet;
    } else {
        walletEl.textContent = 'Connect Wallet';
        if (walletCard) walletCard.onclick = connectWallet;
    }
}

initFarcaster();

// Wheel segments - 5 segments: 3 USDC values, 2 X (loss)
// Harmonious Blue palette: Vibrant Base Blue + Rich Navy Blue
const defaultSegments = [
    { name: '0.01 USDC', value: 0.01, color: '#0052FF', gradient: '#2970FF', isLoss: false },
    { name: 'X', value: 0, color: '#0A2342', gradient: '#0F2D52', isLoss: true },
    { name: '0.001 USDC', value: 0.001, color: '#0066FF', gradient: '#3385FF', isLoss: false },
    { name: 'X', value: 0, color: '#0A2342', gradient: '#0F2D52', isLoss: true },
    { name: '0.02 USDC', value: 0.02, color: '#0052FF', gradient: '#2970FF', isLoss: false }
];

// State
let segments = defaultSegments;
let totalSpins = parseInt(localStorage.getItem('totalSpins')) || 0;
let totalWinnings = parseFloat(localStorage.getItem('totalWinnings')) || 0;
let totalWins = parseInt(localStorage.getItem('totalWins')) || 0;
let isSpinning = false;
let currentRotation = 0;
let soundEnabled = true;

// DOM Elements - wait for DOM to be ready
let canvas, ctx, totalSpinsEl, totalWinningsEl, resultPopup, resultText, closePopup, wheelWrapper, soundBtn;

function initializeDOM() {
    canvas = document.getElementById('wheelCanvas');
    ctx = canvas?.getContext('2d');
    totalSpinsEl = document.getElementById('totalSpins');
    totalWinningsEl = document.getElementById('totalWinnings');
    resultPopup = document.getElementById('resultPopup');
    resultText = document.getElementById('resultText');
    closePopup = document.getElementById('closePopup');
    wheelWrapper = document.getElementById('wheelWrapper');
    soundBtn = document.getElementById('soundBtn');

    if (!canvas || !ctx) {
        console.error('Canvas not found');
        return false;
    }
    return true;
}

function updateWinningsDisplay() {
    if (totalWinningsEl) {
        totalWinningsEl.textContent = `${totalWinnings.toFixed(3)} USDC`;
    }
}

function animateDecoShapes() {
    const shapes = document.querySelectorAll('.deco-shape');
    shapes.forEach((shape, i) => {
        shape.style.animation = 'none';
        shape.offsetHeight;
        shape.style.animation = `decoGlow 0.6s ease ${i * 0.1}s, floatShape 3.5s ease-in-out infinite ${i * 0.5}s`;
    });
}


// Draw wheel
function drawWheel(rotation = 0) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 12;
    const segmentAngle = (2 * Math.PI) / segments.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.translate(-centerX, -centerY);

    // Draw segments
    segments.forEach((segment, i) => {
        const startAngle = i * segmentAngle - Math.PI / 2;
        const endAngle = startAngle + segmentAngle;
        const midAngle = startAngle + segmentAngle / 2;

        // Create gradient for segment
        const gradient = ctx.createLinearGradient(
            centerX + Math.cos(midAngle) * radius,
            centerY + Math.sin(midAngle) * radius,
            centerX,
            centerY
        );
        gradient.addColorStop(0, segment.color);
        gradient.addColorStop(1, segment.gradient);

        // Segment
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Segment border
        ctx.strokeStyle = 'rgba(0, 191, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw content
        const iconX = centerX + Math.cos(midAngle) * radius * 0.6;
        const iconY = centerY + Math.sin(midAngle) * radius * 0.6;

        if (segment.isLoss) {
            // Draw large X for loss
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.strokeStyle = '#ff4757';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.shadowColor = '#ff4757';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(-16, -16);
            ctx.lineTo(16, 16);
            ctx.moveTo(16, -16);
            ctx.lineTo(-16, 16);
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(iconX, iconY);
            let textAngle = midAngle + Math.PI / 2;
            if (midAngle > Math.PI / 2 && midAngle < (3 * Math.PI) / 2) {
                textAngle += Math.PI;
            }
            ctx.rotate(textAngle);

            ctx.font = 'bold 13px SF Pro Display, -apple-system, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.fillText(segment.name, 0, 0);
            ctx.restore();
        }
    });

    // Blue Diamond outer ring - faceted gemstone effect
    const ringWidth = 16;
    const ringRadius = radius + ringWidth / 2 + 2;

    // Deep sapphire base shadow
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#001233';
    ctx.lineWidth = ringWidth + 6;
    ctx.stroke();

    // Faceted diamond gradient - sharp color transitions like gem facets
    const ringGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    ringGradient.addColorStop(0, '#0066CC');
    ringGradient.addColorStop(0.08, '#00D4FF');
    ringGradient.addColorStop(0.12, '#FFFFFF');
    ringGradient.addColorStop(0.18, '#00BFFF');
    ringGradient.addColorStop(0.25, '#0052FF');
    ringGradient.addColorStop(0.35, '#1E90FF');
    ringGradient.addColorStop(0.42, '#FFFFFF');
    ringGradient.addColorStop(0.48, '#00D4FF');
    ringGradient.addColorStop(0.55, '#0052FF');
    ringGradient.addColorStop(0.62, '#00BFFF');
    ringGradient.addColorStop(0.68, '#FFFFFF');
    ringGradient.addColorStop(0.75, '#1E90FF');
    ringGradient.addColorStop(0.82, '#0066CC');
    ringGradient.addColorStop(0.88, '#00D4FF');
    ringGradient.addColorStop(0.92, '#FFFFFF');
    ringGradient.addColorStop(1, '#0052FF');

    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = ringGradient;
    ctx.lineWidth = ringWidth;
    ctx.stroke();

    // Outer cyan glow for depth
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius + ringWidth / 2 + 3, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner bright highlight edge
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius - ringWidth / 2 - 1, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top-left glint (light reflection)
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, -0.5, 0.2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Secondary glint opposite side
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 2.6, 3.3);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
}

// Sound effects - reusable AudioContext for better performance
let audioCtx = null;
let lastTickTime = 0;
const TICK_THROTTLE = 50;

function getAudioContext() {
    if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playTickSound() {
    if (!soundEnabled) return;
    const now = Date.now();
    if (now - lastTickTime < TICK_THROTTLE) return;
    lastTickTime = now;

    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = 500 + Math.random() * 300;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.06;

        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);
        oscillator.stop(ctx.currentTime + 0.03);
    } catch (e) {}
}

function playWinSound() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        const notes = [523.25, 659.25, 783.99, 1046.50];

        notes.forEach((freq, i) => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.value = freq;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;

            oscillator.start(ctx.currentTime + i * 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.2);
            oscillator.stop(ctx.currentTime + i * 0.1 + 0.2);
        });
    } catch (e) {}
}

// Vibration
function vibrate(pattern = [50]) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

// Confetti effect - optimized
function createConfetti() {
    const colors = ['#A8C7FA', '#4285F4', '#0066FF', '#0052FF', '#BCD4F8', '#E3F2FD'];
    const fragment = document.createDocumentFragment();
    const confettiElements = [];

    for (let i = 0; i < 30; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        const size = (5 + Math.random() * 10) + 'px';
        confetti.style.cssText = `
            left: ${Math.random() * 100}vw;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            animation-duration: ${2 + Math.random() * 2}s;
            animation-delay: ${Math.random() * 0.5}s;
            width: ${size};
            height: ${size};
            border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        `;
        fragment.appendChild(confetti);
        confettiElements.push(confetti);
    }

    document.body.appendChild(fragment);
    setTimeout(() => confettiElements.forEach(c => c.remove()), 4000);
}

async function getSpinFeeFromContract() {
    try {
        const response = await fetch('https://mainnet.base.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [{
                    to: SPINON_CONTRACT_ADDRESS,
                    data: SPIN_FEE_SELECTOR
                }, 'latest']
            })
        });
        const data = await response.json();
        if (data.result && data.result !== '0x') {
            return BigInt(data.result).toString();
        }
    } catch (e) {
        console.log('Could not fetch spinFee from contract:', e);
    }
    return BigInt(Math.floor(parseFloat(SPIN_FEE) * 1e18)).toString();
}

// Get pending winnings for an address
async function getPendingWinnings(address) {
    if (!address) return '0';
    try {
        // Encode: pendingWinnings(address) = selector + address padded to 32 bytes
        const paddedAddress = address.toLowerCase().replace('0x', '').padStart(64, '0');
        const data = PENDING_WINNINGS_SELECTOR + paddedAddress;
        
        const response = await fetch('https://mainnet.base.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [{
                    to: SPINON_CONTRACT_ADDRESS,
                    data: data
                }, 'latest']
            })
        });
        const result = await response.json();
        if (result.result && result.result !== '0x') {
            const weiValue = BigInt(result.result);
            return (Number(weiValue) / 1e18).toFixed(6);
        }
    } catch (e) {
        console.error('Error fetching pending winnings:', e);
    }
    return '0';
}

// Claim winnings from contract
async function claimWinnings() {
    if (!walletAddress) {
        showSpinStatus('Please connect your wallet first', true);
        setTimeout(hideSpinStatus, 3000);
        return;
    }

    showSpinStatus('Claiming winnings...');

    try {
        const toAddress = String(SPINON_CONTRACT_ADDRESS).toLowerCase();

        if (sdk?.wallet?.sendTransaction) {
            const result = await sdk.wallet.sendTransaction({
                chainId: `eip155:${BASE_CHAIN_ID}`,
                transaction: {
                    to: toAddress,
                    value: '0x0',
                    data: CLAIM_WINNINGS_SELECTOR
                }
            });
            console.log('Claim transaction result:', result);
            showSpinStatus('Winnings claimed successfully! 🎉');
            setTimeout(hideSpinStatus, 3000);
            return result;
        }

        const provider = sdk?.wallet?.getEthereumProvider?.() || sdk?.wallet?.ethProvider || window.ethereum;
        if (!provider) {
            throw new Error('No wallet provider available');
        }

        const txParams = {
            from: walletAddress.toLowerCase(),
            to: toAddress,
            value: '0x0',
            data: CLAIM_WINNINGS_SELECTOR
        };

        const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [txParams]
        });

        console.log('Claim transaction hash:', txHash);
        showSpinStatus('Winnings claimed successfully! 🎉');
        setTimeout(hideSpinStatus, 3000);
        return txHash;
    } catch (error) {
        console.error('Claim winnings failed:', error);
        showSpinStatus(error.message || 'Claim failed', true);
        setTimeout(hideSpinStatus, 3000);
    }
}

async function executeContractSpin() {
    const spinFeeWei = await getSpinFeeFromContract();
    const spinFunctionData = String(SPIN_FUNCTION_SELECTOR);
    const hexValue = '0x' + BigInt(spinFeeWei).toString(16);
    const toAddress = String(SPINON_CONTRACT_ADDRESS).toLowerCase();

    if (!toAddress || !toAddress.startsWith('0x')) {
        throw new Error('Invalid contract address');
    }

    console.log('Transaction params:', { to: toAddress, value: hexValue, data: spinFunctionData });

    if (sdk?.wallet?.sendTransaction) {
        try {
            console.log('Using sdk.wallet.sendTransaction');
            const result = await sdk.wallet.sendTransaction({
                chainId: `eip155:${BASE_CHAIN_ID}`,
                transaction: {
                    to: toAddress,
                    value: hexValue,
                    data: spinFunctionData
                }
            });
            console.log('SDK sendTransaction result:', result);
            if (result?.transactionHash) {
                return result.transactionHash;
            }
            if (typeof result === 'string') {
                return result;
            }
        } catch (e) {
            console.error('SDK sendTransaction error:', e);
            throw new Error(e.message || 'Transaction rejected');
        }
    }

    let provider = sdk?.wallet?.getEthereumProvider?.() || sdk?.wallet?.ethProvider || window.ethereum;

    if (!provider) {
        throw new Error('No wallet provider available');
    }

    let fromAddress = walletAddress;

    if (!fromAddress) {
        try {
            const accounts = await provider.request({ method: 'eth_accounts' });
            console.log('Accounts:', accounts);
            if (accounts && accounts.length > 0) {
                fromAddress = accounts[0];
            } else {
                const requestedAccounts = await provider.request({ method: 'eth_requestAccounts' });
                if (requestedAccounts && requestedAccounts.length > 0) {
                    fromAddress = requestedAccounts[0];
                }
            }
        } catch (e) {
            console.log('Account request error:', e);
        }
    }

    if (!fromAddress) {
        throw new Error('No wallet address available');
    }

    const txParams = {
        from: String(fromAddress).toLowerCase(),
        to: toAddress,
        value: hexValue,
        data: spinFunctionData
    };

    console.log('Final tx params:', txParams);

    const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams]
    });

    console.log('Transaction hash:', txHash);
    return txHash;
}

function showSpinStatus(message, isError = false) {
    const statusEl = document.getElementById('spinStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `spin-status ${isError ? 'error' : 'pending'}`;
        statusEl.classList.remove('hidden');
    }
}

function hideSpinStatus() {
    const statusEl = document.getElementById('spinStatus');
    if (statusEl) {
        statusEl.classList.add('hidden');
    }
}

// Spin the wheel
async function spinWheel() {
    if (isSpinning) return;

    const hasSDKWallet = sdk?.wallet?.sendTransaction;

    if (!walletAddress && !hasSDKWallet) {
        showSpinStatus('Connecting wallet...');
        const connected = await connectWallet();
        if (!connected && !sdk?.wallet?.sendTransaction) {
            showSpinStatus('Please connect your wallet first', true);
            setTimeout(hideSpinStatus, 3000);
            return;
        }
    }

    showSpinStatus('Waiting for transaction approval...');

    try {
        const txHash = await executeContractSpin();
        showSpinStatus('Transaction confirmed! Spinning...');
        console.log('Spin transaction:', txHash);
    } catch (error) {
        console.error('Contract spin failed:', error);
        showSpinStatus(error.message || 'Transaction failed', true);
        setTimeout(hideSpinStatus, 3000);
        return;
    }

    hideSpinStatus();

    isSpinning = true;
    wheelWrapper.classList.add('spinning');

    // Add sparkle effect
    createSparkles();
    
    // Random target angle
    const spins = 4 + Math.random() * 3;
    const targetAngle = spins * 2 * Math.PI + Math.random() * 2 * Math.PI;
    const duration = 4000 + Math.random() * 2000;
    
    const startTime = Date.now();
    const startRotation = currentRotation;
    let lastTickAngle = 0;
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        
        currentRotation = startRotation + targetAngle * easeProgress;
        drawWheel(currentRotation);
        
        // Tick sound
        const segmentAngle = (2 * Math.PI) / segments.length;
        const currentSegmentAngle = currentRotation % (2 * Math.PI);
        if (Math.floor(currentSegmentAngle / segmentAngle) !== Math.floor(lastTickAngle / segmentAngle)) {
            if (progress < 0.85) {
                playTickSound();
                vibrate([5]);
            }
        }
        lastTickAngle = currentSegmentAngle;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            finishSpin();
        }
    }
    
    animate();
}

async function finishSpin() {
    isSpinning = false;
    wheelWrapper.classList.remove('spinning');

    totalSpins++;
    localStorage.setItem('totalSpins', totalSpins.toString());
    totalSpinsEl.textContent = totalSpins;

    const segmentAngle = (2 * Math.PI) / segments.length;

    let normalizedRotation = currentRotation % (2 * Math.PI);
    if (normalizedRotation < 0) normalizedRotation += 2 * Math.PI;

    let pointerAngle = (2 * Math.PI - normalizedRotation) % (2 * Math.PI);

    const winningIndex = Math.floor(pointerAngle / segmentAngle) % segments.length;
    const winner = segments[winningIndex];

    vibrate([100, 50, 100, 50, 100]);
    createConfetti();

    const popupEmoji = document.querySelector('.popup-emoji');
    const popupTitle = document.querySelector('.popup-content h2');

    const isWin = !winner.isLoss;
    const spinResult = {
        isWin,
        amount: isWin ? winner.value : 0,
        segmentName: winner.name,
        points: isWin ? Math.floor(winner.value * 1000) : 0
    };

    if (winner.isLoss) {
        popupEmoji.textContent = '😢';
        popupTitle.textContent = 'No luck!';
        resultText.innerHTML = `Better luck next time!`;
    } else {
        totalWins++;
        localStorage.setItem('totalWins', totalWins.toString());

        totalWinnings += winner.value;
        localStorage.setItem('totalWinnings', totalWinnings.toString());
        updateWinningsDisplay();

        playWinSound();
        popupEmoji.textContent = '🎉';
        popupTitle.textContent = 'You Won!';
        resultText.innerHTML = `<strong>${winner.name}</strong>`;
    }

    resultPopup.classList.remove('hidden');
    animateDecoShapes();

    if (userId) {
        try {
            await Promise.all([
                recordSpin(userId, spinResult),
                incrementStats(userId, spinResult)
            ]);
        } catch (e) {
            console.error('Error recording spin to database:', e);
        }
    }
}


// Create favicon
function createFavicon() {
    document.getElementById('favicon').href = 'spinon_logo.png';
}

// Sparkle effect when spinning - optimized
function createSparkles() {
    const colors = ['#A8C7FA', '#4285F4', '#0066FF'];
    const rect = wheelWrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = 170;
    const fragment = document.createDocumentFragment();
    const sparkles = [];

    for (let i = 0; i < 8; i++) {
        const sparkle = document.createElement('div');
        const angle = (i / 8) * Math.PI * 2;
        sparkle.style.cssText = `
            position: fixed;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: ${colors[Math.floor(Math.random() * 3)]};
            pointer-events: none;
            z-index: 200;
            left: ${centerX + Math.cos(angle) * radius}px;
            top: ${centerY + Math.sin(angle) * radius}px;
        `;
        fragment.appendChild(sparkle);
        sparkles.push(sparkle);
    }

    document.body.appendChild(fragment);

    sparkles.forEach(sparkle => {
        sparkle.animate([
            { transform: 'scale(0) translateY(0)', opacity: 1 },
            { transform: 'scale(1) translateY(-30px)', opacity: 0 }
        ], {
            duration: 800,
            easing: 'ease-out'
        }).onfinish = () => sparkle.remove();
    });
}

// Event Listeners will be set up in init function

// Pano Banner System
const panoAds = [
    {
        image: 'https://www.spinon.xyz/onchaingm.png',
        title: 'Your Daily Web3 Ritual. GM every day!',
        cta: 'Say GM',
        link: 'https://farcaster.xyz/miniapps/WJydZUDypPkb/onchaingm',
    },
    {
        image: 'https://www.spinon.xyz/infinityname.jpg',
        title: 'Get your unique Web3 domain name!',
        cta: 'Get Yours',
        link: 'https://farcaster.xyz/miniapps/v7M5NCzIgbDZ/infinityname'
    },
    {
        image: 'https://www.spinon.xyz/superboard.png',
        title: 'Meet the new OnchainGM campaign!',
        cta: 'Join Now',
        link: 'https://superboard.xyz/campaigns/meet-the-new-onchaingm'
    }
];

let currentPanoIndex = 0;
let panoBannerVisible = true;
let panoRotationInterval;
let panoBanner, panoLink, panoClose, panoDots, panoImage, panoTitle, panoCta, panoImageWrapper;

function showPano(index) {
    if (!panoBannerVisible || !panoBanner) return;

    currentPanoIndex = index;
    const ad = panoAds[index];

    if (panoImageWrapper) {
        panoImageWrapper.style.display = 'block';
    }

    panoImage.onerror = () => {
        if (panoImageWrapper) {
            panoImageWrapper.style.display = 'none';
        }
    };
    panoImage.onload = () => {
        if (panoImageWrapper) {
            panoImageWrapper.style.display = 'block';
        }
    };

    panoImage.src = ad.image;
    panoTitle.textContent = ad.title;
    panoCta.textContent = ad.cta;
    panoLink.href = ad.link;

    panoDots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function rotatePano() {
    if (!panoBannerVisible) return;
    currentPanoIndex = (currentPanoIndex + 1) % panoAds.length;
    showPano(currentPanoIndex);
}

function initializePano() {
    panoBanner = document.getElementById('adBanner');
    panoLink = document.getElementById('adLink');
    panoClose = document.getElementById('adClose');
    panoImage = document.getElementById('adImage');
    panoImageWrapper = document.querySelector('.pano-image-wrapper');
    panoTitle = document.getElementById('adTitle');
    panoCta = document.getElementById('adCta');
    panoDots = document.querySelectorAll('.pano-dot');

    if (!panoBanner || !panoImage || !panoTitle || !panoCta) return;

    panoDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(dot.dataset.index);
            showPano(index);
            clearInterval(panoRotationInterval);
            panoRotationInterval = setInterval(rotatePano, 8000);
        });
    });

    panoLink.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const ad = panoAds[currentPanoIndex];
        const url = ad?.link;
        console.log('Pano clicked, opening:', url);
        if (url && url !== '#') {
            await openExternalApp(url);
        }
    });

    panoClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panoBanner.classList.remove('show');
        panoBannerVisible = false;
        clearInterval(panoRotationInterval);
    });

    showPano(0);

    setTimeout(() => {
        panoBanner.classList.add('show');
    }, 500);

    panoRotationInterval = setInterval(rotatePano, 8000);
}

// Profile Modal
let profileModal, profileClose, profileOverlay, profileBtn;

function initializeProfile() {
    profileModal = document.getElementById('profileModal');
    profileClose = document.getElementById('profileClose');
    profileOverlay = document.querySelector('.profile-overlay');
    profileBtn = document.getElementById('profileBtn');
    const withdrawBtn = document.getElementById('withdrawBtn');

    if (!profileModal || !profileClose || !profileBtn) return;

    profileBtn.addEventListener('click', () => {
        openProfile();
    });

    profileClose.addEventListener('click', () => {
        closeProfile();
    });

    profileOverlay.addEventListener('click', () => {
        closeProfile();
    });

    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', async () => {
            await claimWinnings();
            // Refresh profile data after claiming
            setTimeout(() => updateProfileData(), 2000);
        });
    }
}

let statsModal, statsClose, statsOverlay;

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const homeBtn = document.getElementById('homeBtn');
    const leaderboardBtn = document.getElementById('leaderboardBtn');

    function setActiveNav(btn) {
        navItems.forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
    }

    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            setActiveNav(homeBtn);
        });
    }

    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', () => {
            openLeaderboard();
        });
    }
}

function initializeStats() {
    statsModal = document.getElementById('statsModal');
    statsClose = document.getElementById('statsClose');
    statsOverlay = document.querySelector('.stats-overlay');

    if (!statsModal || !statsClose) return;

    statsClose.addEventListener('click', () => {
        closeStats();
    });

    if (statsOverlay) {
        statsOverlay.addEventListener('click', () => {
            closeStats();
        });
    }
}

async function openStats() {
    if (!statsModal) return;

    statsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    updateStatsDisplay();
    await loadSpinHistory();
}

function closeStats() {
    if (!statsModal) return;
    statsModal.classList.add('hidden');
    document.body.style.overflow = '';
}

async function updateStatsDisplay() {
    const statsUserPfp = document.getElementById('statsUserPfp');
    const statsUserName = document.getElementById('statsUserName');
    const statsUserHandle = document.getElementById('statsUserHandle');
    const statsWalletBalance = document.getElementById('statsWalletBalance');
    const statsTotalPoints = document.getElementById('statsTotalPoints');
    const statsAllSpins = document.getElementById('statsAllSpins');
    const statsAllWins = document.getElementById('statsAllWins');
    const statsWinRateValue = document.getElementById('statsWinRateValue');
    const statsSyncStatus = document.getElementById('statsSyncStatus');

    if (statsSyncStatus) {
        statsSyncStatus.classList.add('syncing');
        const syncText = statsSyncStatus.querySelector('.sync-text');
        if (syncText) syncText.textContent = 'Syncing';
    }

    if (farcasterUser) {
        if (statsUserPfp && farcasterUser.pfpUrl) {
            statsUserPfp.src = farcasterUser.pfpUrl;
        }
        if (statsUserName) {
            statsUserName.textContent = farcasterUser.displayName || farcasterUser.username || 'Spinner';
        }
        if (statsUserHandle) {
            statsUserHandle.textContent = farcasterUser.username ? `@${farcasterUser.username}` : '@user';
        }
    } else {
        if (statsUserName) statsUserName.textContent = 'Spinner';
        if (statsUserHandle) {
            statsUserHandle.textContent = walletAddress
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : '@user';
        }
    }

    let displaySpins = totalSpins;
    let displayWins = totalWins;
    let displayUsdc = totalWinnings;
    let displayPoints = Math.floor(totalWinnings * 1000);

    if (userId) {
        try {
            const dbStats = await getUserStats(userId);
            if (dbStats) {
                displaySpins = Math.max(displaySpins, dbStats.total_spins);
                displayWins = Math.max(displayWins, dbStats.total_wins);
                displayUsdc = Math.max(displayUsdc, parseFloat(dbStats.total_usdc));
                displayPoints = Math.max(displayPoints, dbStats.total_points);
            }
        } catch (e) {
            console.error('Error fetching stats:', e);
        }
    }

    if (statsWalletBalance) statsWalletBalance.textContent = displayUsdc.toFixed(3);
    if (statsTotalPoints) statsTotalPoints.textContent = displayPoints.toLocaleString();
    if (statsAllSpins) statsAllSpins.textContent = displaySpins.toLocaleString();
    if (statsAllWins) statsAllWins.textContent = displayWins.toLocaleString();

    const winRate = displaySpins > 0 ? Math.round((displayWins / displaySpins) * 100) : 0;
    if (statsWinRateValue) statsWinRateValue.textContent = `${winRate}%`;

    if (statsSyncStatus) {
        statsSyncStatus.classList.remove('syncing');
        const syncText = statsSyncStatus.querySelector('.sync-text');
        if (syncText) syncText.textContent = 'Synced';
    }
}

async function loadSpinHistory() {
    const historyList = document.getElementById('statsHistoryList');
    const historyCount = document.getElementById('statsHistoryCount');

    if (!historyList) return;

    if (!userId) {
        historyList.innerHTML = `
            <div class="stats-history-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
                    <path d="M12 8v4l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
                </svg>
                <p>Connect to see history</p>
                <span>Your spin history will appear here</span>
            </div>
        `;
        if (historyCount) historyCount.textContent = '0 spins';
        return;
    }

    try {
        const history = await getSpinHistory(userId, 20);

        if (!history || history.length === 0) {
            historyList.innerHTML = `
                <div class="stats-history-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
                        <path d="M12 8v4l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
                    </svg>
                    <p>No spins yet</p>
                    <span>Start spinning to see your history!</span>
                </div>
            `;
            if (historyCount) historyCount.textContent = '0 spins';
            return;
        }

        if (historyCount) historyCount.textContent = `${history.length} spin${history.length !== 1 ? 's' : ''}`;

        historyList.innerHTML = history.map(spin => {
            const isWin = spin.result_type === 'win';
            const date = new Date(spin.created_at);
            const formattedDate = formatRelativeTime(date);

            return `
                <div class="stats-history-item">
                    <div class="stats-history-icon ${isWin ? 'win' : 'loss'}">
                        ${isWin ? '&#127881;' : '&#10060;'}
                    </div>
                    <div class="stats-history-details">
                        <div class="stats-history-result">${spin.segment_name}</div>
                        <div class="stats-history-date">${formattedDate}</div>
                    </div>
                    <div class="stats-history-amount ${isWin ? 'win' : 'loss'}">
                        <span class="stats-history-amount-value">${isWin ? '+' : ''}${parseFloat(spin.amount).toFixed(3)}</span>
                        <span class="stats-history-amount-label">USDC</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error('Error loading spin history:', e);
        historyList.innerHTML = `
            <div class="stats-history-empty">
                <p>Unable to load history</p>
                <span>Please try again later</span>
            </div>
        `;
    }
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

let leaderboardModal, leaderboardClose, leaderboardOverlay;

function initializeLeaderboard() {
    leaderboardModal = document.getElementById('leaderboardModal');
    leaderboardClose = document.getElementById('leaderboardClose');
    leaderboardOverlay = document.querySelector('.leaderboard-overlay');

    if (!leaderboardModal || !leaderboardClose) return;

    leaderboardClose.addEventListener('click', () => {
        closeLeaderboard();
    });

    if (leaderboardOverlay) {
        leaderboardOverlay.addEventListener('click', () => {
            closeLeaderboard();
        });
    }
}

async function openLeaderboard() {
    if (!leaderboardModal) return;

    leaderboardModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    await loadLeaderboardData();
}

function closeLeaderboard() {
    if (!leaderboardModal) return;
    leaderboardModal.classList.add('hidden');
    document.body.style.overflow = '';
}

async function loadLeaderboardData() {
    const leaderboardList = document.getElementById('leaderboardList');
    const userPosition = document.getElementById('leaderboardUserPosition');

    if (!leaderboardList) return;

    leaderboardList.innerHTML = `
        <div class="leaderboard-loading">
            <div class="leaderboard-spinner"></div>
            <span>Loading rankings...</span>
        </div>
    `;

    try {
        const rankings = await getLeaderboard(50);

        if (!rankings || rankings.length === 0) {
            leaderboardList.innerHTML = `
                <div class="leaderboard-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                        <path d="M8 21H16M12 17V21M17 4V8C17 10.7614 14.7614 13 12 13C9.23858 13 7 10.7614 7 8V4" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
                    </svg>
                    <p>No rankings yet</p>
                    <span>Be the first to spin and claim your spot!</span>
                </div>
            `;
            return;
        }

        let userRank = -1;
        if (userId) {
            userRank = rankings.findIndex(r => r.user_id === userId) + 1;
        }

        leaderboardList.innerHTML = rankings.map((user, index) => {
            const rank = index + 1;
            const topClass = rank <= 3 ? `top-${rank}` : '';
            const rankDisplay = getRankDisplay(rank);
            const username = user.username || `User ${user.user_id.slice(0, 6)}`;
            const handle = user.username ? `@${user.username}` : `${user.user_id.slice(0, 8)}...`;
            const avatar = user.pfp_url || 'spinon_logo.png';

            return `
                <div class="leaderboard-item ${topClass}">
                    <div class="lb-rank">${rankDisplay}</div>
                    <div class="lb-user">
                        <img class="lb-avatar" src="${avatar}" alt="${username}" onerror="this.src='spinon_logo.png'">
                        <div class="lb-user-details">
                            <span class="lb-username">${escapeHtml(username)}</span>
                            <span class="lb-handle">${escapeHtml(handle)}</span>
                        </div>
                    </div>
                    <div class="lb-spins">${user.total_spins.toLocaleString()}</div>
                    <div class="lb-rewards">${parseFloat(user.total_usdc).toFixed(3)}</div>
                </div>
            `;
        }).join('');

        updateUserPosition(rankings, userRank);

    } catch (e) {
        console.error('Error loading leaderboard:', e);
        leaderboardList.innerHTML = `
            <div class="leaderboard-empty">
                <p>Unable to load rankings</p>
                <span>Please try again later</span>
            </div>
        `;
    }
}

function getRankDisplay(rank) {
    if (rank === 1) {
        return '<div class="lb-rank-badge gold">&#127942;</div>';
    } else if (rank === 2) {
        return '<div class="lb-rank-badge silver">&#129352;</div>';
    } else if (rank === 3) {
        return '<div class="lb-rank-badge bronze">&#129353;</div>';
    }
    return rank;
}

function updateUserPosition(rankings, userRank) {
    const userPosition = document.getElementById('leaderboardUserPosition');
    const lbUserRank = userPosition?.querySelector('.lb-user-rank');
    const lbUserAvatar = document.getElementById('lbUserAvatar');
    const lbUserName = document.getElementById('lbUserName');
    const lbUserHandle = document.getElementById('lbUserHandle');
    const lbUserSpins = document.getElementById('lbUserSpins');
    const lbUserRewards = document.getElementById('lbUserRewards');

    if (!userPosition) return;

    if (farcasterUser) {
        if (lbUserAvatar && farcasterUser.pfpUrl) {
            lbUserAvatar.src = farcasterUser.pfpUrl;
        }
        if (lbUserName) {
            lbUserName.textContent = farcasterUser.displayName || farcasterUser.username || 'You';
        }
        if (lbUserHandle) {
            lbUserHandle.textContent = farcasterUser.username ? `@${farcasterUser.username}` : '@user';
        }
    } else if (walletAddress) {
        if (lbUserName) lbUserName.textContent = 'You';
        if (lbUserHandle) lbUserHandle.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    }

    if (lbUserRank) {
        lbUserRank.textContent = userRank > 0 ? `#${userRank}` : '--';
    }

    if (userId && userRank > 0) {
        const userStats = rankings.find(r => r.user_id === userId);
        if (userStats) {
            if (lbUserSpins) lbUserSpins.textContent = userStats.total_spins.toLocaleString();
            if (lbUserRewards) lbUserRewards.textContent = parseFloat(userStats.total_usdc).toFixed(3);
        }
    } else {
        if (lbUserSpins) lbUserSpins.textContent = totalSpins.toLocaleString();
        if (lbUserRewards) lbUserRewards.textContent = totalWinnings.toFixed(3);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Apps Modal
let appsModal, appsClose, appsOverlay;

function initializeApps() {
    appsModal = document.getElementById('appsModal');
    appsClose = document.getElementById('appsClose');
    appsOverlay = document.querySelector('.apps-overlay');
    const appsBtn = document.getElementById('appsBtn');

    if (!appsModal || !appsClose || !appsBtn) return;

    appsBtn.addEventListener('click', () => {
        openApps();
    });

    appsClose.addEventListener('click', () => {
        closeApps();
    });

    appsOverlay.addEventListener('click', () => {
        closeApps();
    });

    const appCards = document.querySelectorAll('.app-card[data-app-url]');
    appCards.forEach(card => {
        card.addEventListener('click', () => {
            const url = card.dataset.appUrl;
            if (url) {
                openExternalApp(url);
            }
        });
    });
}

async function openExternalApp(url) {
    console.log('Opening external app:', url);
    
    try {
        // Farcaster SDK ile URL açmayı dene
        if (sdk?.actions?.openUrl) {
            console.log('Using sdk.actions.openUrl');
            await sdk.actions.openUrl(url);
            return;
        }
    } catch (e) {
        console.log('sdk.actions.openUrl failed:', e);
    }
    
    // Fallback: Yeni sekmede aç (veya aynı pencerede)
    try {
        const newWindow = window.open(url, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            // Pop-up engellendi, aynı pencerede aç
            window.location.href = url;
        }
    } catch (e) {
        console.log('window.open failed, using location.href:', e);
        window.location.href = url;
    }
}

function openApps() {
    appsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeApps() {
    appsModal.classList.add('hidden');
    document.body.style.overflow = '';
}

async function openProfile() {
    profileModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    await updateProfileData();
}

function closeProfile() {
    profileModal.classList.add('hidden');
    document.body.style.overflow = '';
}

async function updateProfileData() {
    const profilePfp = document.getElementById('profilePfp');
    const profileName = document.getElementById('profileName');
    const profileHandle = document.getElementById('profileHandle');
    const profileTotalSpins = document.getElementById('profileTotalSpins');
    const profileTotalRewards = document.getElementById('profileTotalRewards');
    const profileWinRate = document.getElementById('profileWinRate');
    const profileUsdcBalance = document.getElementById('profileUsdcBalance');
    const withdrawBtn = document.getElementById('withdrawBtn');

    if (farcasterUser) {
        if (farcasterUser.pfpUrl) {
            profilePfp.src = farcasterUser.pfpUrl;
        }
        profileName.textContent = farcasterUser.displayName || farcasterUser.username || 'Spinner';
        profileHandle.textContent = farcasterUser.username ? `@${farcasterUser.username}` : '@user';
    } else {
        profileName.textContent = 'Spinner';
        profileHandle.textContent = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '@user';
    }

    profileTotalSpins.textContent = totalSpins;
    profileTotalRewards.textContent = totalWinnings.toFixed(3);

    const winRate = totalSpins > 0 ? Math.round((totalWins / totalSpins) * 100) : 0;
    profileWinRate.textContent = `${winRate}%`;

    // Fetch pending winnings from contract
    if (walletAddress) {
        const pendingETH = await getPendingWinnings(walletAddress);
        profileUsdcBalance.textContent = `${pendingETH} ETH`;
        
        // Enable/disable withdraw button based on pending winnings
        if (withdrawBtn) {
            const hasPending = parseFloat(pendingETH) > 0;
            withdrawBtn.disabled = !hasPending;
            withdrawBtn.textContent = hasPending ? 'Claim' : 'No Winnings';
        }
    } else {
        profileUsdcBalance.textContent = '0.000 ETH';
        if (withdrawBtn) {
            withdrawBtn.disabled = true;
            withdrawBtn.textContent = 'Connect Wallet';
        }
    }
}

// Initialize
function init() {
    if (!initializeDOM()) {
        setTimeout(init, 100);
        return;
    }

    createFavicon();
    totalSpinsEl.textContent = totalSpins;
    updateWinningsDisplay();
    updateWalletDisplay();

    // Setup event listeners
    wheelWrapper.addEventListener('click', (e) => {
        e.preventDefault();
        spinWheel();
    });
    wheelWrapper.addEventListener('touchend', (e) => {
        e.preventDefault();
        spinWheel();
    }, { passive: false });

    closePopup.addEventListener('click', () => {
        resultPopup.classList.add('hidden');
    });
    resultPopup.addEventListener('click', (e) => {
        if (e.target === resultPopup) {
            resultPopup.classList.add('hidden');
        }
    });
    soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundBtn.querySelector('.nav-icon').textContent = soundEnabled ? '🔊' : '🔇';
        vibrate([30]);
    });

    // Draw wheel immediately
    drawWheel();

    // Initialize pano
    initializePano();

    // Initialize profile
    initializeProfile();

    // Initialize apps
    initializeApps();

    // Initialize stats
    initializeStats();

    // Initialize leaderboard
    initializeLeaderboard();

    // Initialize navigation
    initializeNavigation();
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
