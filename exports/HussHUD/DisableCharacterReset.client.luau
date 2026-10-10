local StarterGui=game:GetService("StarterGui")
local Players=game:GetService("Players")
local function disableReset()
 for attempt=1,60 do
  local ok=pcall(function() StarterGui:SetCore("ResetButtonCallback",false) end)
  if ok then return end
  task.wait(.25)
 end
 warn("Reset menu was not ready; retrying on character spawn.")
end
Players.LocalPlayer.CharacterAdded:Connect(function() task.spawn(disableReset) end)
task.spawn(disableReset)
