local Players=game:GetService("Players")
local titleCatalog=require(game:GetService("ReplicatedStorage"):WaitForChild("HussTitleCatalog"))
local function ensureStats(player)
 local stats=player:FindFirstChild("leaderstats")
 if not stats then stats=Instance.new("Folder") stats.Name="leaderstats" stats.Parent=player end
 for _,entry in ipairs({{"Level",1},{"Wins",0}}) do
  if not stats:FindFirstChild(entry[1]) then
   local value=Instance.new("IntValue") value.Name=entry[1]
   value.Value=tonumber(player:GetAttribute(entry[1])) or entry[2] value.Parent=stats
  end
 end
 return stats
end
local function attach(player,char)
 local head=char:WaitForChild("Head",10)
 local hum=char:WaitForChild("Humanoid",10)
 if not head or not hum or player.Character~=char then return end
 local stats=ensureStats(player)
 hum.DisplayDistanceType=Enum.HumanoidDisplayDistanceType.None
 hum.HealthDisplayType=Enum.HumanoidHealthDisplayType.AlwaysOff
 for _,obj in ipairs(char:GetDescendants()) do if obj.Name=="OverheadRoleMarker" or obj.Name=="HussNameTag" then obj:Destroy() end end
 local tag=Instance.new("BillboardGui")
 tag.Name="HussNameTag" tag.Adornee=head tag.Size=UDim2.fromOffset(270,88)
 tag.StudsOffsetWorldSpace=Vector3.new(0,2.4,0) tag.AlwaysOnTop=true tag.MaxDistance=100 tag.Parent=head
 local title=Instance.new("TextLabel")
 title.Name="SpecialTitle" title.Size=UDim2.new(1,0,0,20) title.BackgroundTransparency=1
 title.FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Heavy)
 title.TextSize=20 title.Text="" title.Visible=false title.Parent=tag
 local titleStroke=Instance.new("UIStroke") titleStroke.Color=Color3.fromRGB(27,24,25) titleStroke.Thickness=1 titleStroke.Transparency=.12 titleStroke.Parent=title
 local gradient=Instance.new("UIGradient") gradient.Rotation=90 gradient.Color=ColorSequence.new(Color3.new(1,1,1),Color3.fromRGB(210,210,210)) gradient.Parent=title
 local function updateTitle()
  local item=titleCatalog.ById[player:GetAttribute("EquippedTitle")]
  title.Text=item and string.upper(item.Name) or ""
  title.Visible=item~=nil
  if item then title.TextColor3=item.Color end
 end
 updateTitle()
 local name=Instance.new("TextLabel")
 name.Name="PlayerName" name.Position=UDim2.fromOffset(0,22) name.Size=UDim2.new(1,0,0,38) name.BackgroundTransparency=1
 name.FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Bold)
 name.Text=player.DisplayName name.TextSize=32 name.TextColor3=Color3.fromRGB(224,237,247)
 name.TextTruncate=Enum.TextTruncate.AtEnd name.Parent=tag
 local border=Instance.new("UIStroke") border.Color=Color3.fromRGB(70,90,109) border.Thickness=1.2 border.Transparency=.1 border.Parent=name
 local details=Instance.new("TextLabel")
 details.Name="Stats" details.Position=UDim2.fromOffset(0,60) details.Size=UDim2.new(1,0,0,23)
 details.BackgroundTransparency=1 details.FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Medium)
 details.TextSize=17 details.TextColor3=Color3.fromRGB(203,220,233) details.Parent=tag
 local line=border:Clone() line.Thickness=.8 line.Transparency=.2 line.Parent=details
 local function update()
  if tag.Parent then
   local level=stats:FindFirstChild("Level")
   local wins=stats:FindFirstChild("Wins")
   details.Text=string.format("Lv. %d · %d wins",level and level.Value or 1,wins and wins.Value or 0)
  end
 end
 update()
 local connections={player:GetAttributeChangedSignal("EquippedTitle"):Connect(updateTitle)}
 for _,key in ipairs({"Level","Wins"}) do
  local value=stats:FindFirstChild(key)
  if value then table.insert(connections,value.Changed:Connect(update)) end
 end
 table.insert(connections,player:GetPropertyChangedSignal("DisplayName"):Connect(function() name.Text=player.DisplayName end))
 tag.Destroying:Connect(function() for _,connection in ipairs(connections) do connection:Disconnect() end end)
end
local function watch(player)
 ensureStats(player)
 player.CharacterAdded:Connect(function(char) task.spawn(attach,player,char) end)
 if player.Character then task.spawn(attach,player,player.Character) end
end
Players.PlayerAdded:Connect(watch)
for _,player in ipairs(Players:GetPlayers()) do watch(player) end

