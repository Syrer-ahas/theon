local Players=game:GetService('Players')
local RS=game:GetService('ReplicatedStorage')
local RunService=game:GetService('RunService')
local TweenService=game:GetService('TweenService')
local UserInputService=game:GetService('UserInputService')
local player=Players.LocalPlayer
local playerGui=player:WaitForChild('PlayerGui')
local gui=playerGui:WaitForChild('BossPanel')
local panel=gui:WaitForChild('Panel')
local fill=panel:WaitForChild('WaitingBar')
local timer=playerGui:WaitForChild('frontend'):WaitForChild('event'):WaitForChild('timer')
local countdown=RS:WaitForChild('BossEventCountdown')
local fullSize=panel:WaitForChild('WaitingBarBackground').Size
-- The bar changes width while retaining its original height.
for _,child in fill:GetChildren() do
 if child:IsA('UIAspectRatioConstraint') then child:Destroy() end
end
local currentCycle
local dismissed=false
local lastSecond
gui.Enabled=false
local restingPosition=panel.Position
local openingTween
local buttonStates={}
local function resetHover()
 for _,state in buttonStates do
  state.hovered=false;state.selected=false;state.pressed=false
  if state.tween then state.tween:Cancel() end
  state.scale.Scale=1
 end
end
for _,button in {panel.Yes,panel.No} do
 button:SetAttribute('CustomHoverEffect',true)
 button.AutoButtonColor=false
 -- Scale around the artwork's center without changing its resting layout.
 local size,position,anchor=button.Size,button.Position,button.AnchorPoint
 button.Position=UDim2.new(position.X.Scale+size.X.Scale*(.5-anchor.X),position.X.Offset+size.X.Offset*(.5-anchor.X),position.Y.Scale+size.Y.Scale*(.5-anchor.Y),position.Y.Offset+size.Y.Offset*(.5-anchor.Y))
 button.AnchorPoint=Vector2.new(.5,.5)
 local scale=button:FindFirstChildOfClass('UIScale') or Instance.new('UIScale')
 scale.Name='BossButtonHoverScale';scale.Scale=1;scale.Parent=button
 local state={scale=scale,hovered=false,selected=false,pressed=false}
 table.insert(buttonStates,state)
 local function update()
  if state.tween then state.tween:Cancel() end
  local active=gui.Enabled and (state.hovered or state.selected)
  state.tween=TweenService:Create(scale,TweenInfo.new(.12,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{Scale=active and (state.pressed and .97 or 1.05) or 1})
  state.tween:Play()
 end
 button.MouseEnter:Connect(function() state.hovered=true;update() end)
 button.MouseLeave:Connect(function() state.hovered=false;state.pressed=false;update() end)
 button.SelectionGained:Connect(function() state.selected=true;update() end)
 button.SelectionLost:Connect(function() state.selected=false;state.pressed=false;update() end)
 button.InputBegan:Connect(function(input)
  if input.UserInputType==Enum.UserInputType.MouseButton1 or input.UserInputType==Enum.UserInputType.Touch or input.KeyCode==Enum.KeyCode.ButtonA then state.pressed=true;state.input=input;update() end
 end)
 UserInputService.InputEnded:Connect(function(input)
  if input==state.input then state.pressed=false;state.input=nil;update() end
 end)
end
UserInputService.WindowFocusReleased:Connect(resetHover)
local function setVisible(visible)
 if gui.Enabled==visible then return end
 if openingTween then openingTween:Cancel();openingTween=nil end
 resetHover()
 if visible then
  local camera=workspace.CurrentCamera
  local height=camera and camera.ViewportSize.Y or 1000
  panel.Position=restingPosition-UDim2.fromOffset(0,height+panel.AbsoluteSize.Y)
  gui.Enabled=true
  openingTween=TweenService:Create(panel,TweenInfo.new(.45,Enum.EasingStyle.Quint,Enum.EasingDirection.Out),{Position=restingPosition})
  openingTween:Play()
 else
  gui.Enabled=false
  panel.Position=restingPosition
 end
end
local function dismiss(choice)
 if not gui.Enabled then return end
 dismissed=true
 gui:SetAttribute('BossChoice',choice)
 setVisible(false)
end
panel.Yes.Activated:Connect(function() dismiss('Yes') end)
panel.No.Activated:Connect(function() dismiss('No') end)
RunService.RenderStepped:Connect(function()
 local cycle=countdown:GetAttribute('Cycle')
 local endsAt=countdown:GetAttribute('EndsAt')
 if typeof(endsAt)~='number' then return end
 if cycle~=currentCycle then
  currentCycle=cycle
  dismissed=false
  gui:SetAttribute('BossChoice',nil)
  setVisible(false)
 end
 local remaining=math.max(0,endsAt-workspace:GetServerTimeNow())
 local second=math.ceil(remaining)
 if second~=lastSecond then
  lastSecond=second
  timer.Text=second==0 and '0s' or string.format('%dm %02ds',math.floor(second/60),second%60)
 end
 local visible=remaining>0 and remaining<=10 and not dismissed
 setVisible(visible)
 if visible then
  local progress=math.clamp(remaining/10,0,1)
  fill.Size=UDim2.new(fullSize.X.Scale*progress,fullSize.X.Offset*progress,fullSize.Y.Scale,fullSize.Y.Offset)
  fill.Visible=true
 else
  fill.Size=fullSize
 end
end)
