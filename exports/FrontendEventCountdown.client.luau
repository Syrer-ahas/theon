local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local player = Players.LocalPlayer
local timer = script.Parent:WaitForChild("timer")
local duration = 30 * 60
local attribute = "FrontendEventCountdownStartedAt"
local startedAt = player:GetAttribute(attribute)
if typeof(startedAt) ~= "number" then
 startedAt = os.clock()
 player:SetAttribute(attribute, startedAt)
end

local lastRemaining
local function update()
 -- Keep zero visible for one second, then repeat. No event is triggered.
 local elapsed = math.max(0, math.floor(os.clock() - startedAt))
 local remaining = duration - (elapsed % (duration + 1))
 if remaining == lastRemaining then return end
 lastRemaining = remaining
 timer.Text = remaining == 0 and "0s"
  or string.format("%dm %02ds", math.floor(remaining / 60), remaining % 60)
end

update()
local connection = RunService.Heartbeat:Connect(update)
script.Destroying:Connect(function()
 connection:Disconnect()
end)
