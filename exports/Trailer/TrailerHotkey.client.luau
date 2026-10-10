local UIS = game:GetService("UserInputService")
local Director = require(game:GetService("ReplicatedStorage"):WaitForChild("TrailerDirector"))
UIS.InputBegan:Connect(function(input, processed)
 if input.KeyCode == Enum.KeyCode.J and not UIS:GetFocusedTextBox() then
  if Director.IsPlaying() then Director.Cancel() elseif not processed then Director.Start() end
 end
end)
