import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';

// Constants
const BASE_CHAIN_ID = 8453;

// Farcaster SDK
let farcasterUser = null;
let currentChainId = null;
let walletAddress = null;

async function initFarcaster() {
    try {
        const context = await sdk.context;
        if (context?.user) {
            farcasterUser = context.user;
            walletAddress = farcasterUser.custody_address || null;
        }
        sdk.actions.ready();
        checkNetwork();
        updateWalletDisplay();
    } catch (e) {
        console.log('Farcaster context not available');
        sdk.actions.ready();
        updateWalletDisplay();
    }
}

async function checkNetwork() {
    try {
        if (window.ethereum) {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            currentChainId = parseInt(chainId, 16);
            updateNetworkStatus();

            window.ethereum.on('chainChanged', (newChainId) => {
                currentChainId = parseInt(newChainId, 16);
                updateNetworkStatus();
            });

            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) {
                    walletAddress = accounts[0];
                    updateWalletDisplay();
                }
            });
        }
    } catch (e) {
        console.log('Network check not available');
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

async function switchToBase() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
        });
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
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
    if (!walletEl) return;

    if (walletCard?.classList.contains('wrong-network')) return;

    if (walletAddress) {
        walletEl.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-3)}`;
    } else if (farcasterUser?.username) {
        walletEl.textContent = `@${farcasterUser.username}`;
    } else {
        walletEl.textContent = '0x...';
    }
}

initFarcaster();

// Wheel segments - 5 segments: 3 USDC values, 2 X (loss)
// Premium color palette: Teal/Gold for wins, Dark for losses
const defaultSegments = [
    { name: '0.01 USDC', value: 0.01, color: '#0d9488', gradient: '#2dd4bf', isLoss: false },
    { name: 'X', value: 0, color: '#1a1a2e', gradient: '#16213e', isLoss: true },
    { name: '0.001 USDC', value: 0.001, color: '#7c3aed', gradient: '#a78bfa', isLoss: false },
    { name: 'X', value: 0, color: '#1a1a2e', gradient: '#16213e', isLoss: true },
    { name: '0.02 USDC', value: 0.02, color: '#d97706', gradient: '#fbbf24', isLoss: false }
];

// State
let segments = defaultSegments;
let totalSpins = parseInt(localStorage.getItem('totalSpins')) || 0;
let totalWinnings = parseFloat(localStorage.getItem('totalWinnings')) || 0;
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
        ctx.strokeStyle = 'rgba(168, 199, 250, 0.4)';
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
            // Draw USDC value text
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.rotate(midAngle + Math.PI / 2);

            // Value text
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

    // Outer metallic ring
    const ringGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    ringGradient.addColorStop(0, '#4285F4');
    ringGradient.addColorStop(0.3, '#A8C7FA');
    ringGradient.addColorStop(0.5, '#0066FF');
    ringGradient.addColorStop(0.7, '#A8C7FA');
    ringGradient.addColorStop(1, '#4285F4');

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
    ctx.strokeStyle = ringGradient;
    ctx.lineWidth = 12;
    ctx.stroke();

    // Ring highlight
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 13, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(168, 199, 250, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ring inner edge
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
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

// Spin the wheel
function spinWheel() {
    if (isSpinning) return;

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

function finishSpin() {
    isSpinning = false;
    wheelWrapper.classList.remove('spinning');

    // Update total spins
    totalSpins++;
    localStorage.setItem('totalSpins', totalSpins.toString());
    totalSpinsEl.textContent = totalSpins;

    // Find winning segment
    const segmentAngle = (2 * Math.PI) / segments.length;

    // Normalize rotation to 0-2π range
    let normalizedRotation = currentRotation % (2 * Math.PI);
    if (normalizedRotation < 0) normalizedRotation += 2 * Math.PI;

    // Calculate the angle at the pointer position
    let pointerAngle = (2 * Math.PI - normalizedRotation) % (2 * Math.PI);

    // Find which segment this angle falls into
    const winningIndex = Math.floor(pointerAngle / segmentAngle) % segments.length;
    const winner = segments[winningIndex];

    // Effects
    vibrate([100, 50, 100, 50, 100]);
    createConfetti();

    // Update popup based on result
    const popupEmoji = document.querySelector('.popup-emoji');
    const popupTitle = document.querySelector('.popup-content h2');

    if (winner.isLoss) {
        popupEmoji.textContent = '😢';
        popupTitle.textContent = 'No luck!';
        resultText.innerHTML = `Better luck next time!`;
    } else {
        // Add winnings
        totalWinnings += winner.value;
        localStorage.setItem('totalWinnings', totalWinnings.toString());
        updateWinningsDisplay();

        playWinSound();
        popupEmoji.textContent = '🎉';
        popupTitle.textContent = 'You Won!';
        resultText.innerHTML = `<strong>${winner.name}</strong>`;
    }

    resultPopup.classList.remove('hidden');

    // Animate decorative shapes
    animateDecoShapes();
}


// Create favicon
function createFavicon() {
    const faviconCanvas = document.createElement('canvas');
    faviconCanvas.width = 32;
    faviconCanvas.height = 32;
    const fctx = faviconCanvas.getContext('2d');

    const center = 16;
    const radius = 14;
    const segmentAngle = (2 * Math.PI) / segments.length;

    segments.forEach((segment, i) => {
        const startAngle = i * segmentAngle - Math.PI / 2;
        const endAngle = startAngle + segmentAngle;

        fctx.beginPath();
        fctx.moveTo(center, center);
        fctx.arc(center, center, radius, startAngle, endAngle);
        fctx.closePath();
        fctx.fillStyle = segment.color;
        fctx.fill();
    });

    fctx.beginPath();
    fctx.arc(center, center, 3, 0, 2 * Math.PI);
    fctx.fillStyle = '#001233';
    fctx.fill();

    fctx.fillStyle = '#4285F4';
    fctx.beginPath();
    fctx.moveTo(center, 0);
    fctx.lineTo(center - 4, 6);
    fctx.lineTo(center + 4, 6);
    fctx.closePath();
    fctx.fill();

    document.getElementById('favicon').href = faviconCanvas.toDataURL('image/png');
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
        image: 'onchaingm.png',
        title: 'Your Daily Web3 Ritual. GM every day!',
        cta: 'Say GM',
        link: 'https://farcaster.xyz/miniapps/WJydZUDypPkb/onchaingm',
    },
   {
        image: 'infinityname.jpg',
        title: 'Get your unique Web3 domain name!',
        cta: 'Get Yours',
        link: 'https://farcaster.xyz/miniapps/v7M5NCzIgbDZ/infinityname'
    },
  {
        image: 'superboard.png',
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
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
