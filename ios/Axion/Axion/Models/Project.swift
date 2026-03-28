import Foundation
import SwiftUI

struct Project: Codable, Identifiable {
    let id: Int
    let name: String
    let description: String?
    let key: String
    let color: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, key, color
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var swiftColor: Color {
        guard let hex = color, hex.hasPrefix("#"), hex.count == 7 else { return .indigo }
        var rgb: UInt64 = 0
        Scanner(string: String(hex.dropFirst())).scanHexInt64(&rgb)
        return Color(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
