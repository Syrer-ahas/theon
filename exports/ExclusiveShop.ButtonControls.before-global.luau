local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local gui = script.Parent
local panel = gui:WaitForChild("Panel")
local close = panel:WaitForChild("CloseButton")
local gift = panel:WaitForChild("GiftPlayerButton")
local giftRequested = gui:WaitForChild("GiftPlayerRequested")

local states = {}
local function update(state)
 local active = state.hovered or state.selected or state.touching
 local target = state.pressed and active and 0.95 or (active and 1.04 or 1)
 if state.tween then state.tween:Cancel() end
 local info = TweenInfo.new(state.pressed and 0.07 or 0.18,
  state.pressed and Enum.EasingStyle.Quad or Enum.EasingStyle.Back, Enum.EasingDirection.Out)
 state.tween = TweenService:Create(state.scale, info, {Scale = target})
 state.tween:Play()
end

for _,button in {close, gift} do
 local state = {scale=button:WaitForChild("InteractionScale"),hovered=false,selected=false,touching=false,pressed=false}
 states[button] = state
 button.MouseEnter:Connect(function() state.hovered=true; update(state) end)
 button.MouseLeave:Connect(function() state.hovered=false; update(state) end)
 button.SelectionGained:Connect(function() state.selected=true; update(state) end)
 button.SelectionLost:Connect(function() state.selected=false; state.pressed=false; update(state) end)
 button.InputBegan:Connect(function(input)
  if input.UserInputType==Enum.UserInputType.MouseButton1 or input.UserInputType==Enum.UserInputType.Touch then
   state.pressed=true
   state.input=input
   state.touching=input.UserInputType==Enum.UserInputType.Touch
   update(state)
  end
 end)
end

UserInputService.InputEnded:Connect(function(input)
 for _,state in states do
  if state.pressed and (input==state.input or input.UserInputType==Enum.UserInputType.MouseButton1 and state.input and state.input.UserInputType==Enum.UserInputType.MouseButton1) then
   state.pressed=false; state.touching=false; state.input=nil
   update(state)
  end
 end
end)
gui:GetPropertyChangedSignal("Enabled"):Connect(function()
 for _,state in states do
  if state.tween then state.tween:Cancel() end
  state.hovered=false; state.selected=false; state.pressed=false; state.touching=false; state.input=nil
  state.scale.Scale=1
 end
end)
UserInputService.WindowFocusReleased:Connect(function()
 for _,state in states do
  state.hovered=false; state.pressed=false; state.touching=false; state.input=nil
  update(state)
 end
end)

close.Activated:Connect(function()
 gui.Enabled=false
end)

gift.Activated:Connect(function()
 -- Connect this event to your existing recipient picker or gifting system.
 giftRequested:Fire()
end)

