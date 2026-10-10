
local Service={}
local Players=game:GetService("Players")
local Marketplace=game:GetService("MarketplaceService")
local RS=game:GetService("ReplicatedStorage")
local catalog=require(RS.HussBallCatalog)
local settings=RS:WaitForChild("HussBallGamepasses")
local remotes=RS.GameRemotes
local remote=remotes:FindFirstChild("BallGamepass") or Instance.new("RemoteFunction") remote.Name="BallGamepass" remote.Parent=remotes
local ids={"Solar","Void","Frost","Dragon"}
local throttle={} local productCache={}
local function getId(id) local value=settings:FindFirstChild(id) return value and value.Value or 0 end
local function grant(p,id,equip)
 p:SetAttribute("OwnedBall_"..id,true) p:SetAttribute("OwnsPass_"..id,true)
 if equip then
  p:SetAttribute("EquippedBall",id)
  task.defer(function()
   local features=require(game.ServerScriptService.HudGameFeatures)
   for _,root in ipairs({p.Backpack,p.Character}) do if root then local tool=root:FindFirstChild("DodgeballTool") if tool and tool:FindFirstChild("Handle") then features.StyleBall(tool.Handle,p) end end end
  end)
 end
end
function Service.Check(p,id,equip)
 local gamepassId=getId(id) if gamepassId<=0 then return false end
 local ok,owned=pcall(Marketplace.UserOwnsGamePassAsync,Marketplace,p.UserId,gamepassId)
 if ok and owned and p.Parent then grant(p,id,equip) return true end
 return false
end
remote.OnServerInvoke=function(p,action,id)
 if type(id)~="string" or not catalog.ById[id] or not catalog.ById[id].Gamepass then return {OK=false} end
 local now=os.clock() if now-(throttle[p] or -10)<.2 then return {OK=false,Message="Please wait a moment."} end throttle[p]=now
 if action~="Info" and action~="Refresh" then return {OK=false} end
 local gamepassId=getId(id)
 local owned=gamepassId>0 and Service.Check(p,id,false) or false
 local info=productCache[gamepassId]
 if gamepassId>0 and (not info or now-info.Time>120) then
  local ok,data=pcall(Marketplace.GetProductInfo,Marketplace,gamepassId,Enum.InfoType.GamePass)
  if ok then info={Time=now,Price=data.PriceInRobux,ForSale=data.IsForSale,Name=data.Name} productCache[gamepassId]=info end
 end
 return {OK=true,Id=gamepassId,Configured=gamepassId>0,Owned=owned or p:GetAttribute("OwnedBall_"..id)==true,Price=info and info.Price,ForSale=info and info.ForSale==true}
end
Marketplace.PromptGamePassPurchaseFinished:Connect(function(p,gamepassId,purchased)
 if not purchased then return end
 for _,id in ipairs(ids) do if getId(id)==gamepassId then task.spawn(function()
  for i=1,3 do if Service.Check(p,id,true) then return end task.wait(i) end
 end) break end end
end)
local function attach(p)
 task.spawn(function() for _,id in ipairs(ids) do if not p.Parent then return end Service.Check(p,id,false) end end)
end
Players.PlayerAdded:Connect(attach)
Players.PlayerRemoving:Connect(function(p) throttle[p]=nil end)
for _,p in ipairs(Players:GetPlayers()) do attach(p) end
return Service

