local Players=game:GetService('Players')
local gui=script.Parent
local scroll=gui:WaitForChild('Panel'):WaitForChild('ScrollingFrame')
local discoveries=Players.LocalPlayer:WaitForChild('DiscoveredItems')
local routes={
 {button=gui:WaitForChild('EnginesButton'),frame=scroll:WaitForChild('ENIGNE')},
 {button=gui:WaitForChild('FuelButton'),frame=scroll:WaitForChild('FUEL')},
 {button=gui:WaitForChild('WheelsButton'),frame=scroll:WaitForChild('WHEEL')},
 {button=gui:WaitForChild('BlocksButton'),frame=scroll:WaitForChild('BLOCKS')},
}
local selected
local icons,connections={},{}
local function update(icon)
 local id=icon:GetAttribute('IndexItemId')
 local flag=id and discoveries:FindFirstChild(id)
 local unlocked=flag and flag:IsA('BoolValue') and flag.Value==true or false
 icon.ImageColor3=unlocked and Color3.new(1,1,1) or Color3.new(0,0,0)
 icon:SetAttribute('IndexDiscovered',unlocked)
end
local function watch(icon)
 if not (icon:IsA('ImageLabel') or icon:IsA('ImageButton')) or icon:GetAttribute('IndexItemIcon')~=true or icons[icon] then return end
 icons[icon]=icon:GetAttributeChangedSignal('IndexItemId'):Connect(function() update(icon) end)
 update(icon)
end
local function refresh(id)
 for icon in icons do if icon:GetAttribute('IndexItemId')==id then update(icon) end end
end
local function watchFlag(flag)
 if not flag:IsA('BoolValue') or connections[flag] then return end
 connections[flag]=flag.Changed:Connect(function() refresh(flag.Name) end)
 refresh(flag.Name)
end
discoveries.ChildAdded:Connect(watchFlag)
discoveries.ChildRemoved:Connect(function(flag)
 if connections[flag] then connections[flag]:Disconnect();connections[flag]=nil end
 refresh(flag.Name)
end)
for _,flag in discoveries:GetChildren() do watchFlag(flag) end
for _,icon in scroll:GetDescendants() do watch(icon) end
scroll.DescendantAdded:Connect(watch)
scroll.DescendantRemoving:Connect(function(icon)
 if icons[icon] then icons[icon]:Disconnect();icons[icon]=nil end
end)
local function showCategory(frame)
 if selected==frame then return end
 selected=frame
 for _,route in routes do route.frame.Visible=route.frame==frame end
 scroll.CanvasPosition=Vector2.zero
end
for _,route in routes do
 route.button.Active=true
 route.button.Activated:Connect(function() showCategory(route.frame) end)
end
showCategory(routes[1].frame)
script.Destroying:Connect(function()
 for _,connection in icons do connection:Disconnect() end
 for _,connection in connections do connection:Disconnect() end
end)
