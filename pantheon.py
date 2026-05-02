"""
pantheon1.0 - Multilevel Clustered Neuronet AI
"""

import math
import random


def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


def sigmoid_derivative(x):
    s = sigmoid(x)
    return s * (1.0 - s)


class Neuron:
    """A single neuron in the network."""

    def __init__(self, num_inputs):
        self.weights = [random.uniform(-1.0, 1.0) for _ in range(num_inputs)]
        self.bias = random.uniform(-1.0, 1.0)
        self.output = 0.0
        self.delta = 0.0

    def activate(self, inputs):
        total = self.bias + sum(w * x for w, x in zip(self.weights, inputs))
        self.output = sigmoid(total)
        return self.output


class Layer:
    """A layer of neurons in the network."""

    def __init__(self, num_neurons, num_inputs_per_neuron):
        self.neurons = [Neuron(num_inputs_per_neuron) for _ in range(num_neurons)]

    def forward(self, inputs):
        return [neuron.activate(inputs) for neuron in self.neurons]


class Cluster:
    """A cluster is a self-contained multilayer sub-network."""

    def __init__(self, layer_sizes):
        self.layers = []
        for i in range(1, len(layer_sizes)):
            self.layers.append(Layer(layer_sizes[i], layer_sizes[i - 1]))

    def forward(self, inputs):
        current = inputs
        for layer in self.layers:
            current = layer.forward(current)
        return current

    def train_step(self, inputs, targets, learning_rate=0.1):
        # Forward pass
        activations = [inputs]
        for layer in self.layers:
            activations.append(layer.forward(activations[-1]))

        # Backward pass — output layer deltas
        output_layer = self.layers[-1]
        for i, neuron in enumerate(output_layer.neurons):
            error = targets[i] - activations[-1][i]
            neuron.delta = error * sigmoid_derivative(
                sum(w * x for w, x in zip(neuron.weights, activations[-2])) + neuron.bias
            )

        # Hidden layer deltas
        for l in range(len(self.layers) - 2, -1, -1):
            for i, neuron in enumerate(self.layers[l].neurons):
                error = sum(
                    self.layers[l + 1].neurons[j].weights[i] * self.layers[l + 1].neurons[j].delta
                    for j in range(len(self.layers[l + 1].neurons))
                )
                raw = (
                    sum(w * x for w, x in zip(neuron.weights, activations[l])) + neuron.bias
                )
                neuron.delta = error * sigmoid_derivative(raw)

        # Weight updates
        for l, layer in enumerate(self.layers):
            for neuron in layer.neurons:
                for k in range(len(neuron.weights)):
                    neuron.weights[k] += learning_rate * neuron.delta * activations[l][k]
                neuron.bias += learning_rate * neuron.delta

        # Return mean squared error
        predictions = activations[-1]
        return sum((t - p) ** 2 for t, p in zip(targets, predictions)) / len(targets)


class Pantheon:
    """
    Multilevel Clustered Neuronet AI.

    Multiple clusters are arranged in a hierarchy:
      - Input is broadcast to all clusters in a level.
      - Each cluster processes its own sub-network.
      - Outputs from all clusters are concatenated and fed to the next level.
    """

    def __init__(self, input_size, cluster_configs):
        """
        Args:
            input_size: Number of features in the input.
            cluster_configs: List of lists of layer-size tuples per level.
                Example: [[(4, [4, 3, 2]), (4, [4, 3, 2])], [(4, [4, 2, 1])]]
                Each element is (num_inputs_for_cluster, [hidden..., output]).
        """
        self.clusters = []
        current_input = input_size
        for level_config in cluster_configs:
            level_clusters = []
            level_output = 0
            for cluster_input, layer_sizes in level_config:
                sizes = [cluster_input] + layer_sizes
                level_clusters.append(Cluster(sizes))
                level_output += layer_sizes[-1]
            self.clusters.append(level_clusters)
            current_input = level_output
        self.input_size = input_size

    def predict(self, inputs):
        current = inputs
        for level_clusters in self.clusters:
            level_output = []
            for cluster in level_clusters:
                level_output.extend(cluster.forward(current))
            current = level_output
        return current

    def train(self, dataset, epochs=1000, learning_rate=0.1):
        """Train all clusters end-to-end (simplified: each cluster trains on its own slice)."""
        history = []
        for epoch in range(epochs):
            total_loss = 0.0
            for inputs, targets in dataset:
                # Propagate forward through every level to collect per-level inputs
                level_inputs = [inputs]
                current = inputs
                for level_clusters in self.clusters:
                    level_output = []
                    for cluster in level_clusters:
                        level_output.extend(cluster.forward(current))
                    current = level_output
                    level_inputs.append(current)

                # Train each cluster in the last level on its output slice
                n_clusters = len(self.clusters[-1])
                chunk = len(targets) // n_clusters or 1
                for idx, cluster in enumerate(self.clusters[-1]):
                    c_inputs = level_inputs[-2]
                    c_targets = targets[idx * chunk: (idx + 1) * chunk]
                    if not c_targets:
                        c_targets = targets
                    loss = cluster.train_step(c_inputs, c_targets, learning_rate)
                    total_loss += loss
            avg_loss = total_loss / len(dataset)
            history.append(avg_loss)
            if (epoch + 1) % 100 == 0:
                print(f"Epoch {epoch + 1}/{epochs}  loss={avg_loss:.6f}")
        return history


# ---------------------------------------------------------------------------
# Demo — XOR problem solved with a two-cluster single-level Pantheon
# ---------------------------------------------------------------------------
def run_demo():
    random.seed(42)

    xor_data = [
        ([0, 0], [0]),
        ([0, 1], [1]),
        ([1, 0], [1]),
        ([1, 1], [0]),
    ]

    # Two clusters, each taking 2 inputs, 1 hidden layer of 3 neurons, 1 output
    cluster_configs = [
        [(2, [3, 1]), (2, [3, 1])],  # level 1: 2 clusters → 2 outputs
    ]

    net = Pantheon(input_size=2, cluster_configs=cluster_configs)

    print("=== Pantheon1.0 Demo — XOR Problem ===")
    print("Training …")
    history = net.train(xor_data, epochs=500, learning_rate=0.5)

    print("\nResults:")
    results = []
    for inputs, targets in xor_data:
        pred = net.predict(inputs)
        # Average the two cluster outputs for the final answer
        answer = sum(pred) / len(pred)
        results.append((inputs, targets[0], round(answer, 4)))
        print(f"  Input: {inputs}  Expected: {targets[0]}  Predicted: {answer:.4f}")

    final_loss = history[-1]
    print(f"\nFinal training loss: {final_loss:.6f}")
    return results, history, final_loss


if __name__ == "__main__":
    run_demo()
