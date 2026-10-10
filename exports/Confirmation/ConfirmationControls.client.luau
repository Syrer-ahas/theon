local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local gui = script.Parent
local layout = gui:WaitForChild("Layout")
local yes = layout:WaitForChild("YesButton")
local caption = yes:WaitForChild("Caption")
local warning = layout:WaitForChild("WarningFrame"):WaitForChild("Warning")
local remote = ReplicatedStorage:WaitForChild("ConfirmRollSkip")
task.spawn(function()
 local images = {}
 for _,object in layout:GetDescendants() do
  if object:IsA("ImageLabel") or object:IsA("ImageButton") then table.insert(images, object) end
 end
 pcall(function() game:GetService("ContentProvider"):PreloadAsync(images) end)
end)
local token, readyAt
local colors = {Legendary="#FFD52E", Mythic="#FF4949", Secret="#E988FF"}
local function close()
 token = nil
 readyAt = nil
 gui.Enabled = false
end
local function cancel()
 if token then remote:FireServer(token, false) end
 close()
end
layout.NoButton.Activated:Connect(cancel)
yes.Activated:Connect(function()
 if not token or not readyAt or workspace:GetServerTimeNow() < readyAt then return end
 remote:FireServer(token, true)
 close()
end)
gui:GetPropertyChangedSignal("Enabled"):Connect(function()
 if not gui.Enabled and token then cancel() end
end)
remote.OnClientEvent:Connect(function(action, requestToken, rarity, serverReadyAt)
 if action == "Close" then
  if requestToken == token then close() end
  return
 end
 if action ~= "Open" or typeof(requestToken) ~= "string" or typeof(serverReadyAt) ~= "number"
  or not colors[rarity] then return end
 token, readyAt = requestToken, serverReadyAt
 warning.Text = 'Are you sure to skip this\n<font color="'..colors[rarity]..'">'..rarity..'</font> item?'
 caption.Text = string.format("%.2f", math.max(0, readyAt-workspace:GetServerTimeNow()))
 yes.ImageColor3 = Color3.fromRGB(130,130,130)
 gui.Enabled = true
end)
RunService.RenderStepped:Connect(function()
 if not gui.Enabled or not token then return end
 local remaining = math.max(0,readyAt-workspace:GetServerTimeNow())
 caption.Text = remaining > 0 and string.format("%.2f",remaining) or "YES"
 yes.ImageColor3 = remaining > 0 and Color3.fromRGB(130,130,130) or Color3.new(1,1,1)
end)
gui.Enabled = false
