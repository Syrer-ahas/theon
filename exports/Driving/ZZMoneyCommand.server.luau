local Players = game:GetService("Players")
local TextChatService = game:GetService("TextChatService")
local InventoryData = require(script.Parent:WaitForChild("PlayerInventoryData"))
local ALLOWED_USER_ID = 2244568819
local lastGrant = {}
local function grant(player)
 if not player or player.UserId ~= ALLOWED_USER_ID then return end
 if player:GetAttribute("InventoryDataLoaded") ~= true then return end
 local money = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Money")
 if not money or not money:IsA("IntValue") then return end
 local now = os.clock()
 if now-(lastGrant[player] or -math.huge) < 1 then return end
 lastGrant[player] = now
 money.Value += 1000
 InventoryData.QueueSave(player)
end
local command = TextChatService:FindFirstChild("ZZMoneyCommand") or Instance.new("TextChatCommand")
command.Name = "ZZMoneyCommand"
command.PrimaryAlias = "/zz"
command.AutocompleteVisible = false
command.Enabled = true
command.Parent = TextChatService
command.Triggered:Connect(function(textSource, message)
 if typeof(message) ~= "string" or not message:lower():match("^%s*/zz%s*$") then return end
 grant(textSource and Players:GetPlayerByUserId(textSource.UserId))
end)
if TextChatService.ChatVersion == Enum.ChatVersion.LegacyChatService then
 local function watch(player)
  player.Chatted:Connect(function(message)
   if message:lower():match("^%s*/zz%s*$") then grant(player) end
  end)
 end
 Players.PlayerAdded:Connect(watch)
 for _,player in Players:GetPlayers() do watch(player) end
end
Players.PlayerRemoving:Connect(function(player) lastGrant[player] = nil end)
