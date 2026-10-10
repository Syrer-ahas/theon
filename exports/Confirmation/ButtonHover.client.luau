local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local gui = script.Parent
local layout = gui:WaitForChild("Layout")
local states = {}
local function update(state, instant)
 local active = state.hovered or state.selected or state.touching
 local target = state.pressed and active and 0.97 or (active and 1.045 or 1)
 if state.tween then state.tween:Cancel(); state.tween = nil end
 if instant then state.scale.Scale = 1; return end
 state.tween = TweenService:Create(state.scale, TweenInfo.new(state.pressed and 0.07 or 0.16, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {Scale = target})
 state.tween:Play()
end
local function reset(state)
 state.hovered = false
 state.selected = false
 state.touching = false
 state.pressed = false
 state.input = nil
 update(state, true)
end
for _,button in {layout.NoButton, layout.YesButton} do
 local scale = button:FindFirstChildOfClass("UIScale") or Instance.new("UIScale")
 scale.Name = "ConfirmationHoverScale"
 scale.Scale = 1
 scale.Parent = button
 local state = {scale = scale}
 table.insert(states, state)
 button.MouseEnter:Connect(function() state.hovered = true; update(state) end)
 button.MouseLeave:Connect(function() state.hovered = false; update(state) end)
 button.SelectionGained:Connect(function() state.selected = true; update(state) end)
 button.SelectionLost:Connect(function() state.selected = false; update(state) end)
 button.InputBegan:Connect(function(input)
  if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
   state.pressed = true
   state.touching = input.UserInputType == Enum.UserInputType.Touch
   state.input = input
   update(state)
  end
 end)
end
UserInputService.InputEnded:Connect(function(input)
 for _,state in states do
  if state.pressed and (state.input == input or input.UserInputType == Enum.UserInputType.MouseButton1) then
   state.pressed = false; state.touching = false; state.input = nil; update(state)
  end
 end
end)
UserInputService.WindowFocusReleased:Connect(function()
 for _,state in states do reset(state) end
end)
gui:GetPropertyChangedSignal("Enabled"):Connect(function()
 if not gui.Enabled then for _,state in states do reset(state) end end
end)

