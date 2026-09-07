chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open-extension') return;
  try {
    await chrome.action.openPopup();
  } catch (error) {
    console.warn('Could not open popup from command:', error);
  }
});
