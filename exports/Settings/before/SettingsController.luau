local Players=game:GetService('Players')
local RS=game:GetService('ReplicatedStorage')
local Tween=game:GetService('TweenService')
local SoundService=game:GetService('SoundService')
local Lighting=game:GetService('Lighting')
local player=Players.LocalPlayer
local gui=player:WaitForChild('PlayerGui'):WaitForChild('Settings')
local rows=gui.Panel.ScrollingFrame
local remote=RS:WaitForChild('SettingsUpdate')
local defaults={Music=true,SoundEffects=true,ButtonSound=true,ScreenShakes=true,HideCars=false,Performance=false,InvitePolicy='Everyone'}
local function get(key) local v=player:GetAttribute('Setting_'..key);if v==nil then return defaults[key] end;return v end
local function set(key,value) if player:GetAttribute('SettingsLoaded') then remote:FireServer(key,value) end end
local groups={}
for _,key in {'Music','SoundEffects','ButtonSound'} do
 local g=Instance.new('SoundGroup');g.Name='Settings'..key;g.Parent=SoundService;groups[key]=g
end
local sounds={}
local function registerSound(sound)
 if not sound:IsA('Sound') or sounds[sound] then return end
 local kind=sound:GetAttribute('SettingsCategory')
 if not groups[kind] then
  local name=sound.Name:lower();local path=sound:GetFullName():lower()
  kind=(name:find('music') or name:find('bgm')) and 'Music' or (path:find('playergui') or name:find('click') or name:find('hover') or name:find('button') or name:find('ui_')) and 'ButtonSound' or 'SoundEffects'
 end
 sounds[sound]={original=sound.SoundGroup,kind=kind}
 -- Keep existing group mixes/effects intact; mute through a child group.
 local original=sound.SoundGroup
 if original then
  local group=original:FindFirstChild('Settings'..kind)
  if not group then group=Instance.new('SoundGroup');group.Name='Settings'..kind;group.Volume=get(kind) and 1 or 0;group.Parent=original end
  sound.SoundGroup=group
 else sound.SoundGroup=groups[kind] end
end
local switches={};local tweens={}
for key in defaults do
 if key~='InvitePolicy' then
  local row=rows:FindFirstChild(key=='Performance' and 'Perfornance' or key)
  local button=row and row:FindFirstChild('slide')
  if button then
   button:SetAttribute('CustomHoverEffect',true)
   local track=row.slider
   switches[key]={button=button,track=track,y=button.Position.Y}
   button.Activated:Connect(function() set(key,not get(key)) end)
   track.Active=true
   track.InputBegan:Connect(function(input) if input.UserInputType==Enum.UserInputType.MouseButton1 or input.UserInputType==Enum.UserInputType.Touch then set(key,not get(key)) end end)
  end
 end
end
local policies={'Everyone','Friends','Nobody'}
local policyButton=rows['Co-OpSettings'].Frame
policyButton.Activated:Connect(function()
 local i=table.find(policies,get('InvitePolicy')) or 1;set('InvitePolicy',policies[i%3+1])
end)
local parts={};local effects={};local hidden={};local hideScheduled=false
local originalShadows=Lighting.GlobalShadows
local function shouldHide(p)
 if not get('HideCars') then return false end
 local n=p.Parent
 while n and n~=workspace do
  local owner=n:GetAttribute('OwnerUserId')
  if owner and n:GetAttribute('BuildItemId') then return owner~=player.UserId end
  if n.Parent and n.Parent.Name=='ActiveVehicles' then return owner~=nil and owner~=player.UserId end
  n=n.Parent
 end
 return false
end
local function refreshCars()
 for p in parts do
  if shouldHide(p) then if hidden[p]==nil then hidden[p]=p.LocalTransparencyModifier end;p.LocalTransparencyModifier=1
  elseif hidden[p]~=nil then p.LocalTransparencyModifier=hidden[p];hidden[p]=nil end
 end
end
local function performance(n)
 local old=effects[n]
 if old==nil then return end
 local value=old;if get('Performance') then value=false end
 if n:IsA('BasePart') then n.CastShadow=value else n.Enabled=value end
end
local function register(n)
 registerSound(n)
 if n:IsA('BasePart') and n:IsDescendantOf(workspace) then
  parts[n]=true;effects[n]=n.CastShadow;performance(n)
  if not hideScheduled then hideScheduled=true;task.defer(function() hideScheduled=false;refreshCars() end) end
 elseif n:IsA('ParticleEmitter') or n:IsA('Trail') or n:IsA('Beam') or n:IsA('Smoke') or n:IsA('Fire') or n:IsA('Sparkles') or n:IsA('BloomEffect') or n:IsA('DepthOfFieldEffect') or n:IsA('SunRaysEffect') then
  effects[n]=n.Enabled;performance(n)
 end
end
local function apply(key)
 local state=switches[key]
 if state then
  local on=get(key)
  if tweens[key] then tweens[key]:Cancel() end
  local track,button=state.track,state.button
  local anchor=track.AnchorPoint.X
  local left=track.Position.X.Scale-track.Size.X.Scale*anchor
  local right=left+track.Size.X.Scale-button.Size.X.Scale
  tweens[key]=Tween:Create(button,TweenInfo.new(.18),{Position=UDim2.new(on and right or left,0,state.y.Scale,state.y.Offset),ImageColor3=on and Color3.fromRGB(115,255,132) or Color3.new(1,1,1)})
  tweens[key]:Play();button:SetAttribute('SettingEnabled',on)
 elseif key=='InvitePolicy' then policyButton.status.Text=string.upper(get(key)) end
 if groups[key] then
  groups[key].Volume=get(key) and 1 or 0
  for sound,state in sounds do if state.kind==key and sound.SoundGroup then sound.SoundGroup.Volume=get(key) and 1 or 0 end end
 elseif key=='HideCars' then refreshCars()
 elseif key=='Performance' then Lighting.GlobalShadows=originalShadows;if get(key) then Lighting.GlobalShadows=false end;for n in effects do performance(n) end end
end
for _,n in game:GetDescendants() do register(n) end
game.DescendantAdded:Connect(register)
game.DescendantRemoving:Connect(function(n) parts[n]=nil;effects[n]=nil;hidden[n]=nil;sounds[n]=nil end)
for key in defaults do player:GetAttributeChangedSignal('Setting_'..key):Connect(function() apply(key) end);apply(key) end
-- Restore car visibility when ownership changes, without per-frame scans.
local ownershipConnections={}
local function watch(n)
 if n:IsA('Model') and (n:GetAttribute('BuildItemId') or n:GetAttribute('OwnerUserId')) then ownershipConnections[n]=n:GetAttributeChangedSignal('OwnerUserId'):Connect(refreshCars) end
end
for _,n in workspace:GetDescendants() do watch(n) end
workspace.DescendantAdded:Connect(watch)
workspace.DescendantRemoving:Connect(function(n) if ownershipConnections[n] then ownershipConnections[n]:Disconnect();ownershipConnections[n]=nil end end)
