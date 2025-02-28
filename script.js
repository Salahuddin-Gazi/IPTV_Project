// Initialize Video.js player
const player = videojs('video-player', {
  autoplay: true,
  controls: true,
  fluid: true,
});

let originalChannels = []; // Store the original list of channels

async function loadChannels(file) {
  // Show loader
  document.getElementById('loader').style.display = 'block';
  document.getElementById('loader-progress').textContent = '0%';

  // Clear the existing channel list and reset available channels count
  document.getElementById('channel-list').innerHTML = '';
  document.getElementById('available-channels').textContent = '0';

  let channels = [];
  if (typeof file === 'string') {
    // Fetch and display channels for the selected category
    channels = await fetchPlaylist(file);
  } else {
    channels = file;
  }

  document.getElementById('total-channels').textContent = channels.length;
  await filterAvailableChannels(channels);

  // Hide loader after filtering
  document.getElementById('loader').style.display = 'none';
}

// Populate the category select dropdown
function populateCategorySelect() {
  const categorySelect = document.getElementById('category-select');
  categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>'; // Reset dropdown

  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category.url;
    option.textContent = category.name;
    categorySelect.appendChild(option);
  });

  // Add event listener to handle category selection
  categorySelect.addEventListener('change', async (event) => {
    const selectedUrl = event.target.value;
    if (selectedUrl) {
      loadChannels(selectedUrl);
    }
  });
}

// Fetch and parse the IPTV playlist
async function fetchPlaylist(url) {
  try {
    const response = await fetch(url);
    const playlistText = await response.text();

    // Check if this is a single channel URL or a playlist
    // if (url.endsWith('.m3u8') || !playlistText.includes('#EXTINF:')) {
    if (!playlistText.includes('#EXTINF:')) {
      // This is likely a direct stream URL or HLS playlist, create a single channel object
      return [{
        name: "Live Stream", // Customize the name as needed
        logo: "", // Add a logo if available
        url: url, // The URL of the .m3u8 file
        group: "Live", // Optional: Group for organization
        id: "live-stream" // Optional: Unique ID
      }];
    }

    // Otherwise, parse it as a traditional .m3u playlist
    return parsePlaylist(playlistText, url);
  } catch (error) {
    console.error("Error fetching playlist:", error);
    // If fetch fails, it might be a direct stream URL
    return [{
      name: "Channel " + (originalChannels.length + 1),
      logo: "",
      url: url
    }];
  }
}

// Parse the .m3u playlist
function parsePlaylist(playlistText, sourceUrl) {
  const channels = [];
  const lines = playlistText.split('\n');

  // Skip parsing if this is an HLS playlist
  if (playlistText.includes('#EXT-X-VERSION')) {
    return [{
      name: "Live Stream", // Customize the name as needed
      logo: "", // Add a logo if available
      url: sourceUrl, // The URL of the .m3u8 file
      group: "Live", // Optional: Group for organization
      id: "live-stream" // Optional: Unique ID
    }];
  }

  // Otherwise, parse it as a traditional .m3u playlist
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
      const channelInfoParts = lines[i].split(',');
      let channelName = channelInfoParts.length > 1 ? channelInfoParts[1].trim() : "Unnamed Channel";

      // Extract additional metadata if available
      const logoMatch = lines[i].match(/tvg-logo="([^"]+)"/);
      const groupMatch = lines[i].match(/group-title="([^"]+)"/);
      const idMatch = lines[i].match(/tvg-id="([^"]+)"/);

      const logo = logoMatch ? logoMatch[1] : '';
      const group = groupMatch ? groupMatch[1] : '';
      const id = idMatch ? idMatch[1] : '';

      // Get the stream URL from the next line
      const streamUrl = i + 1 < lines.length ? lines[i + 1].trim() : '';

      if (streamUrl && !streamUrl.startsWith('#')) {
        channels.push({
          name: channelName,
          logo,
          url: streamUrl,
          group,
          id
        });
      }
    }
  }

  return channels;
}

// Helper function to add a channel to the list
function addChannelToList(channel) {
  const channelList = document.getElementById('channel-list');
  const channelItem = document.createElement('div');
  channelItem.className = 'channel-item';
  channelItem.dataset.url = channel.url; // Add URL to dataset

  channelItem.innerHTML = `
    <img src="${channel.logo}" alt="${channel.name}" onerror="this.src='https://images.ctfassets.net/ihx0a8chifpc/oPtkn7DsBOsv8aitV1qns/1606c26302d81bab448e3a39581f86b5/lorem-flickr-1280x720.jpg?w=1280&q=60&fm=webp'">
    <span>${channel.name}</span>
    ${channel.group ? `<small class="channel-group">${channel.group}</small>` : ''}
  `;

  channelItem.addEventListener('click', () => {
    // Update current playing channel display
    const currentChannelElement = document.querySelector('.current-channel-name');
    if (currentChannelElement) {
      currentChannelElement.textContent = channel.name;
    }

    // Play the channel
    player.src({ type: 'application/x-mpegURL', src: channel.url });
    player.play();

    // Highlight the active channel
    document.querySelectorAll('.channel-item.active').forEach(el => el.classList.remove('active'));
    channelItem.classList.add('active');
  });

  channelList.appendChild(channelItem);
}

// Populate the channel list
function populateChannelList(channels) {
  const channelList = document.getElementById('channel-list');
  channelList.innerHTML = '';
  const searchBox = document.getElementById('search-box');
  const searchTerm = searchBox.value.toLowerCase();

  if (searchTerm === '') {
    channels.forEach((channel) => addChannelToList(channel));
  } else {
    // Filter the original channels based on the search term
    const filteredChannels = [...originalChannels].filter(channel =>
      channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (channel.group && channel.group.toLowerCase().includes(searchTerm.toLowerCase())) ||
      channel.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      channel.logo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filteredChannels.forEach((channel) => addChannelToList(channel));
  }
}

// Filter out unavailable channels
// async function filterAvailableChannels(channels) {
//   const totalChannels = channels.length;
//   let processedChannels = 0;
//   let availableCount = 0;

//   // Clear the existing channel list
//   document.getElementById('channel-list').innerHTML = '';
//   originalChannels = []; // Reset original channels

//   for (const channel of channels) {
//     try {
//       const response = await fetch(channel.url);

//       if (response.ok) {
//         // Add the channel regardless of response (some valid streams might not respond correctly to HEAD)
//         originalChannels.push(channel);
//         availableCount++;
//       }

//       // Only update the UI occasionally to improve performance
//       if (availableCount % 5 === 0 || availableCount === 1) {
//         populateChannelList(originalChannels);
//         document.getElementById('available-channels').textContent = originalChannels.length;
//       }
//     } catch (error) {
//       console.warn(`Channel ${channel.name} check failed:`, error);
//     }

//     processedChannels++;
//     const progress = Math.round((processedChannels / totalChannels) * 100);
//     document.getElementById('loader-progress').textContent = `${progress}%`;
//   }

//   // Final update to ensure all channels are displayed
//   // populateChannelList(originalChannels);
//   // document.getElementById('available-channels').textContent = originalChannels.length;
// }

async function filterAvailableChannels(channels) {
  const totalChannels = channels.length;
  let processedChannels = 0;
  let availableCount = 0;
  document.getElementById('channel-list').innerHTML = '';
  originalChannels = [];

  const fetchWithTimeout = (url, timeout = 30000) => {
    return Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
    ]);
  };

  const fetchPromises = channels.map(async (channel) => {
    try {
      const response = await fetchWithTimeout(channel.url);
      if (response.ok) {
        originalChannels.push(channel);
        availableCount++;
      }
    } catch (error) {
      console.warn(`Channel ${channel.name} check failed:`, error);
    }

    processedChannels++;
    const progress = Math.round((processedChannels / totalChannels) * 100);
    document.getElementById('loader-progress').textContent = `${progress}%`;

    if (availableCount % 5 === 0 || availableCount === 1) {
      populateChannelList(originalChannels);
      document.getElementById('available-channels').textContent = originalChannels.length;
    }
  });

  await Promise.all(fetchPromises);

  populateChannelList(originalChannels);
  document.getElementById('available-channels').textContent = originalChannels.length;
  document.getElementById('loader-progress').textContent = '100%';
}


// Function to read a local .m3u file
async function readLocalM3UFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function fetchLocalPlaylists() {
  const fileInput = document.getElementById('m3u-file-input');
  const files = fileInput.files;

  for (const file of files) {
    try {
      const playlistText = await readLocalM3UFile(file);
      const channels = parsePlaylist(playlistText, file.name);
      await loadChannels(channels);
    } catch (error) {
      console.error(`Error reading ${file.name}:`, error);
    }
  }
}

// Process URL from input field
async function processUrlInput() {
  const urlBox = document.getElementById('url-box');
  const url = urlBox.value.trim();

  if (url) {
    try {
      await loadChannels(url);
    } catch (error) {
      console.error("Error loading URL:", error);
      // Display error message to user
      alert(`Failed to load the URL: ${error.message}`);
    }
  } else {
    alert("Please enter a valid M3U URL");
  }
}

// Initialize the app
async function init() {
  // Populate the category select dropdown
  populateCategorySelect();

  // Add search functionality
  const searchBox = document.getElementById('search-box');
  searchBox.addEventListener('input', () => {
    const searchTerm = searchBox.value.toLowerCase();

    if (searchTerm === '') {
      // If the search field is cleared, restore the full list of available channels
      populateChannelList(originalChannels);
    } else {
      // Filter the original channels based on the search term
      const filteredChannels = [...originalChannels].filter(channel =>
        channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (channel.group && channel.group.toLowerCase().includes(searchTerm.toLowerCase())) ||
        channel.url?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      populateChannelList(filteredChannels);
    }
  });

  // Handle file input change
  const fileInput = document.getElementById('m3u-file-input');
  const selectedFilesDiv = document.getElementById('selected-files');

  fileInput.addEventListener('change', () => {
    const files = fileInput.files;

    if (files.length > 0) {
      const lists = Array.from(files).map(file => `<p>${file.name}</p>`);
      selectedFilesDiv.innerHTML = lists.join('');
    } else {
      selectedFilesDiv.textContent = 'No files chosen';
    }
  });

  // Handle load files button click
  const loadFilesButton = document.getElementById('load-files');
  loadFilesButton.addEventListener('click', async () => await fetchLocalPlaylists());

  // Handle URL input box
  const urlBoxButton = document.querySelector('.url-box-button');
  urlBoxButton.addEventListener('click', async () => await processUrlInput());

  // Also allow pressing Enter in the URL box
  const urlBox = document.getElementById('url-box');
  urlBox.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      await processUrlInput();
    }
  });

  // Add element for displaying current channel name if it doesn't exist
  if (!document.querySelector('.current-channel-name')) {
    const currentChannelDiv = document.createElement('div');
    currentChannelDiv.className = 'current-channel-name';
    currentChannelDiv.textContent = 'No channel selected';
    document.querySelector('.video-container').appendChild(currentChannelDiv);
  }
}

// Start the app
init();