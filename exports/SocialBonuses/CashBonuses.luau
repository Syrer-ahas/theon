local Players=game:GetService('Players')
local Bonuses={}
local sessions={}
local pairs={}
local started=false
local function publish(player,s)
 local count=0
 for friend in s.friends do if sessions[friend] and friend.Parent==Players then count+=1 end end
 s.friendPercent=count*10
 player:SetAttribute('FriendCashBonus',s.friendPercent)
 player:SetAttribute('PlusCashBonus',s.plus and 25 or 0)
 player:SetAttribute('CashBonusPercent',s.friendPercent+(s.plus and 25 or 0))
 player:SetAttribute('CashBonusReady',s.ready)
end
local function pair(a,b)
 local sa,sb=sessions[a],sessions[b]
 if not sa or not sb or a==b then return end
 local key=tostring(math.min(a.UserId,b.UserId))..':'..tostring(math.max(a.UserId,b.UserId))
 if pairs[key] then return end
 pairs[key]={a=a,b=b}
 task.spawn(function()
  local ok,friends=pcall(function() return a:IsFriendsWithAsync(b.UserId) end)
  if sessions[a]~=sa or sessions[b]~=sb then return end
  if ok and friends then sa.friends[b]=true;sb.friends[a]=true;publish(a,sa);publish(b,sb) end
 end)
end
local function join(player)
 if sessions[player] then return end
 local s={friends={},plus=false,ready=false,fraction=0,friendPercent=0}
 sessions[player]=s;publish(player,s)
 for other in sessions do pair(player,other) end
 -- Read Roblox's verified membership flag once at join, then freeze it for this session.
 local ok,subscribed=pcall(function() return player.HasRobloxSubscription end)
 s.plus=ok and subscribed==true;s.ready=true
 player:SetAttribute('PlusCheckFailed',not ok)
 publish(player,s)
 if not ok then warn('Roblox Plus join check failed for '..player.UserId..'; no unverified bonus granted.') end
end
function Bonuses.Start()
 if started then return end;started=true
 Players.PlayerAdded:Connect(join)
 Players.PlayerRemoving:Connect(function(player)
  sessions[player]=nil
  for _,s in sessions do s.friends[player]=nil end
  for other,s in sessions do publish(other,s) end
  for key,value in pairs do if value.a==player or value.b==player then pairs[key]=nil end end
 end)
 for _,player in Players:GetPlayers() do join(player) end
end
function Bonuses.Award(player,baseAmount)
 assert(typeof(baseAmount)=='number' and baseAmount==baseAmount and baseAmount>=0 and baseAmount<math.huge and baseAmount%1==0,'Invalid cash award')
 local s=sessions[player]
 if not s then return false,0 end
 -- Join verification can yield. All awards use the same final cached result.
 while sessions[player]==s and not s.ready do task.wait(.05) end
 if sessions[player]~=s or player:GetAttribute('InventoryDataLoaded')~=true then return false,0 end
 local stats=player:FindFirstChild('leaderstats');local money=stats and stats:FindFirstChild('Money')
 if not money or not money:IsA('IntValue') then return false,0 end
 local percent=s.friendPercent+(s.plus and 25 or 0)
 -- Preserve fractional bonus cents across small rewards without rounding inflation.
 local hundredths=baseAmount*percent+s.fraction
 local extra=math.floor(hundredths/100);s.fraction=hundredths%100
 local total=baseAmount+extra
 money.Value+=total
 return true,total
end
return Bonuses
