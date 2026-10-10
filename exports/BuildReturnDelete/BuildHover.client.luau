local TweenService=game:GetService("TweenService")
local UserInputService=game:GetService("UserInputService")
local gui=script.Parent
local layout=gui:WaitForChild("Layout")
local zad=gui.Parent:WaitForChild("ZAD")
local oldScale=layout:FindFirstChild("BuildHoverScale")
if oldScale then oldScale:Destroy() end
local states={}
local function tween(state,key,object,duration,properties,style)
 if state.tweens[key] then state.tweens[key]:Cancel() end
 local t=TweenService:Create(object,TweenInfo.new(duration,style or Enum.EasingStyle.Quart,Enum.EasingDirection.Out),properties)
 state.tweens[key]=t
 t:Play()
 return t
end
local function update(button,state)
 local active=state.hovered or state.selected
 tween(state,"scale",state.scale,state.pressed and .06 or active and .14 or .16,
  {Scale=state.pressed and .94 or active and 1.15 or 1},active and not state.pressed and Enum.EasingStyle.Back or Enum.EasingStyle.Quart)
 tween(state,"pose",button,.14,{Rotation=0,Position=state.position})
end
local function reset(button,state)
 state.hovered=false;state.selected=false;state.pressed=false
 for _,t in state.tweens do t:Cancel() end
 table.clear(state.tweens)
 state.scale.Scale=1
 button.Position=state.position
 button.Rotation=0
end
for _,name in {"BuildButton","ReturnButton","DeleteButton"} do
 local button=layout:WaitForChild(name)
 button.AutoButtonColor=false
 button:SetAttribute("CustomHoverEffect",true)
 local scale=button:FindFirstChild("BuildButtonScale") or Instance.new("UIScale")
 scale.Name="BuildButtonScale";scale.Scale=1;scale.Parent=button
 local state={scale=scale,position=button.Position,tweens={},hovered=false,selected=false,pressed=false}
 states[button]=state
 button.MouseEnter:Connect(function() state.hovered=true;update(button,state) end)
 button.MouseLeave:Connect(function() state.hovered=false;state.pressed=false;update(button,state) end)
 button.SelectionGained:Connect(function() state.selected=true;update(button,state) end)
 button.SelectionLost:Connect(function() state.selected=false;update(button,state) end)
 button.InputBegan:Connect(function(input)
  if input.UserInputType==Enum.UserInputType.MouseButton1 or input.UserInputType==Enum.UserInputType.Touch or input.KeyCode==Enum.KeyCode.ButtonA then state.pressed=true;state.input=input;update(button,state) end
 end)
 button:GetPropertyChangedSignal("Visible"):Connect(function()
  reset(button,state)

 end)
end
UserInputService.InputEnded:Connect(function(input)
 for button,state in states do
  if state.pressed and (state.input==input or input.UserInputType==Enum.UserInputType.MouseButton1 or input.KeyCode==Enum.KeyCode.ButtonA) then state.pressed=false;update(button,state) end
 end
end)
UserInputService.WindowFocusReleased:Connect(function() for button,state in states do reset(button,state) end end)
gui:GetPropertyChangedSignal("Enabled"):Connect(function() if not gui.Enabled then for button,state in states do reset(button,state) end end end)
layout:GetPropertyChangedSignal("Visible"):Connect(function() if not layout.Visible then for button,state in states do reset(button,state) end end end)
