# CookingAssistantXR - Specification

## Project Overview
Unity AR Cooking Assistant for Samsung Galaxy XR with voice command system.

## Key Technical Decisions
- **Unity Version**: Unity 6 (6000.0.58f2+) - MANDATORY for Android XR support
- **Render Pipeline**: URP with Vulkan
- **Speech Recognition**: On-device Android SpeechRecognizer (primary), VOSK as fallback
- **Wake Word**: Physical button trigger for V1 (wake word V2)
- **Language**: Korean primary (ko-KR)
- **Command Vocabulary**: 15 commands across 3 domains
- **AR UI**: 2D world-space Canvas panels
- **DI Pattern**: Simple ServiceLocator
- **Recipe Data**: Hardcoded JSON, 5 Korean recipes

## Architecture
- Native Android AAR plugin for SpeechRecognizer → UnitySendMessage bridge → C# CommandInterpreter → CommandDispatcher → Handlers
- Threading: Speech on Android Main Thread, commands on Unity Main Thread
- ISpeechRecognizer abstraction for engine swapability

## V1 Commands (15 total)
### Recipe Navigation (6): NextStep, PreviousStep, RepeatStep, GoToStep, ShowIngredients, ShowAllSteps
### Timer (4): SetTimer, CancelTimer, CheckTimer, PauseTimer
### System (5): Help, Cancel, SelectRecipe, StartCooking, StopListening

## Implementation Priority
1. Project setup (Unity 6, packages, build profile)
2. Native speech plugin (AAR)
3. VoiceCommandBridge + ISpeechRecognizer
4. CommandInterpreter + CommandRegistry
5. RecipeManager + JSON recipes
6. AR UI panels (world-space Canvas)
7. Wire everything together
8. Timer system
9. Polish (feedback, error handling)

## Performance Targets
- Command acknowledgment: < 500ms
- Frame rate: 72fps minimum sustained
- Session duration: 60 minutes continuous
- Recognition accuracy: 95%+ for defined vocabulary
