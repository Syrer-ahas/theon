-- Roblox owns the camera and shift-lock. This only changes its bound keys.
local Players=game:GetService("Players")
local UIS=game:GetService("UserInputService")
local player=Players.LocalPlayer
local originalSensitivity=UIS.MouseDeltaSensitivity
local function sensitivity()
 UIS.MouseDeltaSensitivity=player:GetAttribute("HussSensitivity") or originalSensitivity*.6
end
sensitivity()
player:GetAttributeChangedSignal("HussSensitivity"):Connect(sensitivity)
-- Current Roblox player scripts live under StarterPlayer and use InputAction bindings.
local StarterPlayer=game:GetService("StarterPlayer")
local configuredActions={}
local function configureAction(action)
 if configuredActions[action] then return end
 configuredActions[action]=true
 local primary=action:FindFirstChild("KeyboardPrimaryBinding")
 local secondary=action:FindFirstChild("KeyboardSecondaryBinding")
 if primary then primary.KeyCode=Enum.KeyCode.LeftControl end
 if secondary then secondary.KeyCode=Enum.KeyCode.RightControl end
 local function availability()
  action.Enabled=player.DevEnableMouseLock and UIS.PreferredInput==Enum.PreferredInput.KeyboardAndMouse
 end
 -- Ctrl is an explicit game control, independently of the account's Shift setting.
 action:GetPropertyChangedSignal("Enabled"):Connect(function()
  if not action.Enabled and player.DevEnableMouseLock and UIS.PreferredInput==Enum.PreferredInput.KeyboardAndMouse then
   task.defer(availability)
  end
 end)
 UIS:GetPropertyChangedSignal("PreferredInput"):Connect(availability)
 player:GetPropertyChangedSignal("DevEnableMouseLock"):Connect(availability)
 availability()
end
local function findAction(root)
 for _,item in root:GetDescendants() do
  if item:IsA("InputAction") and item.Name=="MouseLockSwitchAction" then configureAction(item) end
 end
end
findAction(StarterPlayer)
StarterPlayer.DescendantAdded:Connect(function(item)
 if item:IsA("InputAction") and item.Name=="MouseLockSwitchAction" then
  task.defer(function() configureAction(item) end)
 end
end)

-- Support the older default PlayerModule on clients that still use it.
local playerScripts=player:WaitForChild("PlayerScripts")
local function legacy(module)
 local mouseLock=module:FindFirstChild("MouseLockController",true)
 if not mouseLock then return end
 local keys=mouseLock:FindFirstChild("BoundKeys")
 if not keys then keys=Instance.new("StringValue") keys.Name="BoundKeys" keys.Parent=mouseLock end
 keys.Value="LeftControl,RightControl"
end
local module=playerScripts:FindFirstChild("PlayerModule")
if module then legacy(module) end
playerScripts.ChildAdded:Connect(function(child)
 if child.Name=="PlayerModule" then task.defer(function() legacy(child) end) end
end)

-- A small outlined reticle for the native mouse-lock mode.
local RunService=game:GetService("RunService")
local GuiService=game:GetService("GuiService")
local TweenService=game:GetService("TweenService")
local cursorGui=Instance.new("ScreenGui")
cursorGui.Name="HussShiftLockCursor"
cursorGui.IgnoreGuiInset=true
cursorGui.ResetOnSpawn=false
cursorGui.DisplayOrder=100
cursorGui.Parent=player:WaitForChild("PlayerGui")
local reticle=Instance.new("Frame")
reticle.Name="Reticle"
reticle.AnchorPoint=Vector2.new(.5,.5)
reticle.Position=UDim2.fromScale(.5,.5)
reticle.Size=UDim2.fromOffset(22,22)
reticle.BackgroundTransparency=1
reticle.Visible=false
reticle.Parent=cursorGui
local function mark(name,x,y,w,h)
 local part=Instance.new("Frame")
 part.Name=name
 part.AnchorPoint=Vector2.new(.5,.5)
 part.Position=UDim2.fromScale(x,y)
 part.Size=UDim2.fromOffset(w,h)
 part.BackgroundColor3=Color3.fromRGB(245,250,255)
 part.BorderSizePixel=0
 part.Parent=reticle
 local corner=Instance.new("UICorner")
 corner.CornerRadius=UDim.new(0,2)
 corner.Parent=part
 local stroke=Instance.new("UIStroke")
 stroke.Color=Color3.fromRGB(16,23,29)
 stroke.Thickness=1
 stroke.Transparency=.15
 stroke.Parent=part
end
mark("Top",.5,0,2,5)
mark("Bottom",.5,1,2,5)
mark("Left",0,.5,5,2)
mark("Right",1,.5,5,2)
mark("Dot",.5,.5,3,3)
local cameras
task.spawn(function()
 local native=StarterPlayer:FindFirstChild("PlayerModule") or playerScripts:FindFirstChild("PlayerModule")
 if native then
  local cameraModule=native:FindFirstChild("CameraModule")
  if cameraModule then
   local ok,result=pcall(require,cameraModule)
   if ok then cameras=result end
  end
 end
end)
local cursorWasEnabled=UIS.MouseIconEnabled
local hidingCursor=false
RunService.RenderStepped:Connect(function()
 local controller=cameras and cameras.activeMouseLockController
 local locked=controller and controller:GetIsMouseLocked() or false
 local show=locked and UIS.MouseBehavior==Enum.MouseBehavior.LockCenter
  and not GuiService.MenuIsOpen and not player:GetAttribute("HudModalOpen")
  and not UIS:GetFocusedTextBox()
 if show~=reticle.Visible then
  reticle.Visible=show
  if show then
   reticle.Size=UDim2.fromOffset(28,28)
   TweenService:Create(reticle,TweenInfo.new(.12,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{Size=UDim2.fromOffset(22,22)}):Play()
  end
 end
 if show then
  if not hidingCursor then cursorWasEnabled=UIS.MouseIconEnabled hidingCursor=true end
  UIS.MouseIconEnabled=false
 elseif hidingCursor then
  hidingCursor=false
  UIS.MouseIconEnabled=cursorWasEnabled
 end
end)

