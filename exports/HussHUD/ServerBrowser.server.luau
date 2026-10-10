local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local RunService=game:GetService("RunService")
local MemoryStoreService=game:GetService("MemoryStoreService")
local TeleportService=game:GetService("TeleportService")
local LocalizationService=game:GetService("LocalizationService")
local remotes=RS:WaitForChild("GameRemotes")
local remote=Instance.new("RemoteFunction") remote.Name="ServerBrowser" remote.Parent=remotes
local index=not RunService:IsStudio() and MemoryStoreService:GetSortedMap("HussPublicServers_v1") or nil
local countries={} local lastRequest={}
local names={US="United States",DE="Germany",FR="France",GB="United Kingdom",AU="Australia",IN="India",JP="Japan",SG="Singapore",NL="Netherlands",CA="Canada",BR="Brazil",PL="Poland",TR="Turkey",ID="Indonesia",PH="Philippines",MX="Mexico",ES="Spain",IT="Italy",KR="South Korea"}
local function region(player)
 local ok,value=pcall(function() return LocalizationService:GetCountryRegionForPlayerAsync(player) end)
 if ok then countries[player]=names[value] or value end
end
Players.PlayerAdded:Connect(function(p) task.spawn(region,p) end)
for _,p in ipairs(Players:GetPlayers()) do task.spawn(region,p) end
local function current()
 local voters={} local major,count="Public server",0 local ping=0
 for _,p in ipairs(Players:GetPlayers()) do
  local r=countries[p] or "Public server" voters[r]=(voters[r] or 0)+1
  if voters[r]>count then major,count=r,voters[r] end
  ping+=p:GetNetworkPing()*1000
 end
 local n=#Players:GetPlayers()
 return {Id=game.JobId~="" and game.JobId or "Studio",Region=major,Players=n,MaxPlayers=Players.MaxPlayers,State=remotes:GetAttribute("RoundState")=="Active" and "Match in progress" or "Lobby",Ping=n>0 and math.floor(ping/n+.5) or 0,Updated=os.time()}
end
local function publish()
 if index then local row=current() pcall(function() index:SetAsync(game.JobId,row,75,os.time()) end) end
end
remote.OnServerInvoke=function(player,action,id)
 local now=os.clock() if now-(lastRequest[player] or -math.huge)<1 then return {Servers={},Ping=math.floor(player:GetNetworkPing()*1000),OK=false,Message="Please wait a moment."} end lastRequest[player]=now
 if action=="List" then
  local own=current() own.Here=true local rows={own}
  if index then
   local ok,data=pcall(function() return index:GetRangeAsync(Enum.SortDirection.Descending,100) end)
   if ok then for _,entry in ipairs(data) do local row=entry.value if type(row)=="table" and row.Id~=own.Id and os.time()-(row.Updated or 0)<75 then row.Here=false table.insert(rows,row) end end end
  end
  return {Servers=rows,Ping=math.floor(player:GetNetworkPing()*1000+.5)}
 elseif action=="Join" then
  if RunService:IsStudio() then return {OK=false,Message="Server switching is available in the published game."} end
  if remotes:GetAttribute("RoundState")=="Active" and player:GetAttribute("PlayerRole")~="Lobby" then return {OK=false,Message="Finish your match before switching servers."} end
  if type(id)~="string" or #id>100 or id==game.JobId then return {OK=false,Message="Choose another public server."} end
  local ok,row=pcall(function() return index:GetAsync(id) end)
  if not ok or not row or row.Players>=row.MaxPlayers then return {OK=false,Message="This server is full or no longer available."} end
  local sent=pcall(function() TeleportService:TeleportToPlaceInstance(game.PlaceId,id,player) end)
  return {OK=sent,Message=sent and "Joining…" or "Could not join. Please try again."}
 end
 return {OK=false,Message="Unknown request."}
end
Players.PlayerRemoving:Connect(function(p) countries[p]=nil lastRequest[p]=nil end)
task.spawn(function() while true do publish() task.wait(20) end end)
game:BindToClose(function() if index then pcall(function() index:RemoveAsync(game.JobId) end) end end)
