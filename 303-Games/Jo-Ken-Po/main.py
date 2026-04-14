rock = '''
    _______
---'   ____)
      (_____)
      (_____)
      (____)
---.__(___)
'''

paper = '''
    _______
---'   ____)____
          ______)
          _______)
         _______)
---.__________)
'''

scissors = '''
    _______
---'   ____)____
          ______)
       __________)
      (____)
---.__(___)
'''

import random

# El código está ahora dentro de una función para facilitar el reinicio. 
def play_game():
    while True:
        user = int(input("\nWhat do you choose? Type 0 for Rock, 1 for Paper, or 2 for Scissors: "))
        computer = random.randint(0, 2)
        choices = [rock, paper, scissors]

        if user < 0 or user > 2:
            print("You typed an invalid number, you lose!")
        else:
            print("You chose:")
            print(choices[user])
            print("Computer chose:")
            print(choices[computer])

            delta = user - computer
            if delta == 1 or delta == -2:
                print("You win! 😁")
            elif delta == -1 or delta == 2:
                print("You lose! 😭")
            else:
                print("It's a draw! 🙃")

        # Preguntar si quiere jugar otra vez
        play_again = input("\nDo you want to play again? Type 'y' for Yes or 'n' for No: ").lower()

        if play_again != 'y':
            print("Thanks for playing!")
            break

play_game()
